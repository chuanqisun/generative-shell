import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
import homepage from "../web/index.html";
import { generateScript } from "./ai";
import { parse } from "./args";

const activeProcesses = new Map<string, ReturnType<typeof Bun.spawn>>();

async function main() {
  const { absoluteWorkingDirectory: cwd } = parse(process.argv);
  console.log(`[mugen] started in ${cwd}`);

  const server = Bun.serve({
    development: true,
    routes: {
      "/api/shell/subscribe": {
        GET: (req) => {
          server.timeout(req, 0); // prevent SSE timeout error
          const url = new URL(req.url);
          const command = url.searchParams.get("command");
          const id = url.searchParams.get("id") || Math.random().toString(36).substring(2);

          if (!command) {
            return new Response("Missing command parameter", { status: 400 });
          }

          console.log(`[mugen] executing shell command via SSE: ${command}`);
          let proc: ReturnType<typeof Bun.spawn> | undefined;
          let isClosed = false;

          const stream = new ReadableStream({
            async start(controller) {
              try {
                proc = Bun.spawn(["bash", "-c", command], {
                  cwd,
                  stdout: "pipe",
                  stderr: "pipe",
                });

                activeProcesses.set(id, proc);

                const readPipe = async (
                  readable: ReadableStream<Uint8Array> | number | null | undefined,
                  type: "stdout" | "stderr"
                ) => {
                  if (!readable || typeof readable === "number") return;
                  const reader = readable.getReader();
                  const decoder = new TextDecoder();
                  try {
                    while (true) {
                      const { done, value } = await reader.read();
                      if (done || isClosed) break;
                      const text = decoder.decode(value, { stream: true });
                      if (text) {
                        controller.enqueue(
                          `data: ${JSON.stringify({ type, text })}\n\n`
                        );
                      }
                    }
                    const leftover = decoder.decode();
                    if (leftover && !isClosed) {
                      controller.enqueue(
                        `data: ${JSON.stringify({ type, text: leftover })}\n\n`
                      );
                    }
                  } catch {
                    // ignore errors on process termination/close
                  } finally {
                    reader.releaseLock();
                  }
                };

                await Promise.all([
                  readPipe(proc.stdout, "stdout"),
                  readPipe(proc.stderr, "stderr"),
                  proc.exited,
                ]);

                if (!isClosed) {
                  isClosed = true;
                  activeProcesses.delete(id);
                  controller.enqueue(
                    `data: ${JSON.stringify({ type: "exit", code: proc.exitCode })}\n\n`
                  );
                  controller.close();
                }
              } catch (error) {
                if (!isClosed) {
                  isClosed = true;
                  activeProcesses.delete(id);
                  controller.enqueue(
                    `data: ${JSON.stringify({ type: "stderr", text: String(error) })}\n\n`
                  );
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
        POST: async (req) => {
          const { filename, content } = await req.json();
          console.log(`[mugen] saving file: ${filename}`);
          await Bun.write(`${cwd}/${filename}`, content);
          return Response.json({ success: true });
        },
      },
      "/api/code": {
        POST: async (req) => {
          const { files, prompt } = await req.json();
          console.log(`[mugen] received task: ${JSON.stringify({ files, prompt })}`);

          const script = await generateScript({ files, prompt, cwd });
          console.log(`[mugen] generated script`, script);
          return Response.json(script);
        },
      },
      "/api/run": {
        POST: async (req) => {
          const payload = await req.json();
          console.log(`[mugen] run script`, payload);

          try {
            const synthesizeFunction = new Function(`${payload}\nreturn main();`);
            const result = await synthesizeFunction();
            return Response.json(result);
          } catch (error) {
            console.error(`[mugen] error running script: ${error}`);
            return Response.json({ error: String(error) }, { status: 500 });
          }
        },
      },
      "/": homepage,
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`Listening on ${url}`);
}

main();
