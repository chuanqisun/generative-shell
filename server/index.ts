import { watch } from "node:fs";
import { readdir } from "node:fs/promises";
import homepage from "../web/index.html";
import { generateScript } from "./ai";
import { parse } from "./args";

async function main() {
  const { absoluteWorkingDirectory: cwd } = parse(process.argv);
  console.log(`[mugen] started in ${cwd}`);

  const server = Bun.serve({
    development: true,
    routes: {
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
