import { readdir } from "node:fs/promises";
import homepage from "../web/index.html";
import { parse } from "./args";

async function main() {
  const { absoluteWorkingDirectory: cwd } = parse(process.argv);
  console.log(`[mugen] started in ${cwd}`);

  const server = Bun.serve({
    development: true,
    routes: {
      "/api/files": {
        GET: async () => {
          const files = await readdir(cwd);
          return new Response(JSON.stringify(files), {
            headers: { "Content-Type": "application/json" },
          });
        },
      },
      "/api/tasks": {
        POST: async (req) => {
          const payload = await req.json();
          console.log(`[mugen] received task: ${JSON.stringify(payload)}`);
          return new Response(JSON.stringify({ status: "ok" }), {
            headers: { "Content-Type": "application/json" },
          });
        },
      },
      "/": homepage,
    },
  });

  const url = `http://localhost:${server.port}`;
  console.log(`Listening on ${url}`);
}

main();
