import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
import homepage from "../web/index.html";
import { parse } from "./args";

const activeProcesses = new Map<string, ReturnType<typeof Bun.spawn>>();

async function main() {
  const { absoluteWorkingDirectory: cwd } = parse(process.argv);
  const defaultShell = process.env.SHELL || "bash";
  console.log(`[mugen] started in ${cwd} (shell: ${defaultShell})`);

  const server = Bun.serve({
    development: true,
    routes: {
      "/api/shell/subscribe": {
        GET: (req) => {
          server.timeout(req, 0); // prevent SSE timeout error
          const url = new URL(req.url);
          const command = url.searchParams.get("command");
          const id = url.searchParams.get("id") || Math.random().toString(36).substring(2);
          const pty = url.searchParams.get("pty") !== "false";
          const cols = parseInt(url.searchParams.get("cols") || "80", 10);
          const rows = parseInt(url.searchParams.get("rows") || "24", 10);

          console.log(`[mugen] starting persistent shell session (id: ${id}, shell: ${defaultShell}, pty: ${pty})`);
          let proc: ReturnType<typeof Bun.spawn> | undefined;
          let isClosed = false;

          const stream = new ReadableStream({
            async start(controller) {
              try {
                if (pty) {
                  const decoder = new TextDecoder();
                  proc = Bun.spawn([defaultShell], {
                    cwd,
                    env: process.env,
                    terminal: {
                      cols,
                      rows,
                      data(_term, data) {
                        if (isClosed) return;
                        const text = decoder.decode(data, { stream: true });
                        if (text) {
                          controller.enqueue(`data: ${JSON.stringify({ type: "stdout", text })}\n\n`);
                        }
                      },
                    },
                  });

                  activeProcesses.set(id, proc);

                  if (command && proc.terminal) {
                    proc.terminal.write(command + "\n");
                  }

                  await proc.exited;

                  const leftover = decoder.decode();
                  if (leftover && !isClosed) {
                    controller.enqueue(`data: ${JSON.stringify({ type: "stdout", text: leftover })}\n\n`);
                  }
                } else {
                  proc = Bun.spawn([defaultShell], {
                    cwd,
                    env: process.env,
                    stdin: "pipe",
                    stdout: "pipe",
                    stderr: "pipe",
                  });

                  activeProcesses.set(id, proc);

                  if (command && proc.stdin && typeof proc.stdin !== "number") {
                    proc.stdin.write(command + "\n");
                  }

                  const readPipe = async (readable: ReadableStream<Uint8Array> | number | null | undefined, type: "stdout" | "stderr") => {
                    if (!readable || typeof readable === "number") return;
                    const reader = readable.getReader();
                    const decoder = new TextDecoder();
                    try {
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done || isClosed) break;
                        const text = decoder.decode(value, { stream: true });
                        if (text) {
                          controller.enqueue(`data: ${JSON.stringify({ type, text })}\n\n`);
                        }
                      }
                      const leftover = decoder.decode();
                      if (leftover && !isClosed) {
                        controller.enqueue(`data: ${JSON.stringify({ type, text: leftover })}\n\n`);
                      }
                    } catch {
                      // ignore errors on process termination/close
                    } finally {
                      reader.releaseLock();
                    }
                  };

                  await Promise.all([readPipe(proc.stdout, "stdout"), readPipe(proc.stderr, "stderr"), proc.exited]);
                }

                if (!isClosed) {
                  isClosed = true;
                  activeProcesses.delete(id);
                  controller.enqueue(`data: ${JSON.stringify({ type: "exit", code: proc.exitCode })}\n\n`);
                  controller.close();
                }
              } catch (error) {
                if (!isClosed) {
                  isClosed = true;
                  activeProcesses.delete(id);
                  controller.enqueue(`data: ${JSON.stringify({ type: "stderr", text: String(error) })}\n\n`);
                  controller.close();
                }
              }
            },
            cancel() {
              isClosed = true;
              if (proc) {
                console.log(`[mugen] cancelling shell command execution (id: ${id})`);
                proc.kill();
                activeProcesses.delete(id);
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        },
      },
      "/api/shell/cancel": {
        POST: async (req) => {
          try {
            const { id } = await req.json();
            if (id && activeProcesses.has(id)) {
              console.log(`[mugen] cancelling process via API endpoint: ${id}`);
              const proc = activeProcesses.get(id);
              proc?.kill();
              activeProcesses.delete(id);
            }
            return Response.json({ success: true });
          } catch (error) {
            return Response.json({ error: String(error) }, { status: 500 });
          }
        },
      },
      "/api/shell/input": {
        POST: async (req) => {
          try {
            const { id, data } = await req.json();
            if (id && data) {
              const proc = activeProcesses.get(id);
              if (proc?.terminal) {
                proc.terminal.write(data);
              } else if (proc?.stdin && typeof proc.stdin !== "number") {
                proc.stdin.write(data);
              }
            }
            return Response.json({ success: true });
          } catch (error) {
            return Response.json({ error: String(error) }, { status: 500 });
          }
        },
      },
      "/api/shell/resize": {
        POST: async (req) => {
          try {
            const { id, cols, rows } = await req.json();
            if (id && cols && rows) {
              const proc = activeProcesses.get(id);
              if (proc?.terminal) {
                proc.terminal.resize(cols, rows);
              }
            }
            return Response.json({ success: true });
          } catch (error) {
            return Response.json({ error: String(error) }, { status: 500 });
          }
        },
      },
      "/api/files/subscribe": {
        GET: (req) => {
          let watcher: ReturnType<typeof watch>;
          server.timeout(req, 0); // prevent SSE timeout error
          const stream = new ReadableStream({
            start(controller) {
              watcher = watch(cwd, (eventType, filename) => {
                const data = JSON.stringify({ eventType, filename });
                controller.enqueue(`data: ${data}\n\n`);
              });
            },
            cancel() {
              watcher?.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        },
      },
      "/api/files": {
        GET: async () => {
          const files = await readdir(cwd);
          return Response.json(files);
        },
      },
      "/": homepage,
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`Listening on ${url}`);
}

main();
