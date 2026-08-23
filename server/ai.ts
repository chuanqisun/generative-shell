import { GoogleGenAI } from "@google/genai";
import path from "node:path";

export interface GenerateScriptResut {
  files: string[];
  prompt: string;
  cwd: string;
}

export async function generateScript({ files, prompt, cwd }: GenerateScriptResut) {
  const ai = new GoogleGenAI({});

  const paths = files.map((filename) => safeJoinPath(cwd, filename));

  const filesContext = (
    await Promise.all(
      paths.map(async (filename) => {
        const content = await Bun.file(filename).text();
        return `=== ${filename} ===\n${content}`;
      }),
    )
  ).join("\n\n");

  const interaction = await ai.interactions.create({
    model: "gemini-3.7-flash",
    system_instruction: `Follow user\'s instructions to write a javascript function:
    
async function main() {
  // ...your code must return the output
}
  
You have access to Bun APIs for read/write files and fetch data from the web
Respond with raw js code and nothing else`,
    input: `${prompt}${filesContext ? `\n\nThe result should be based on the following files:\n${filesContext}` : ""}`,
    generation_config: {
      thinking_summaries: "none",
      thinking_level: "low",
    },
  });

  return interaction.output_text;
}

function safeJoinPath(base: string, relative: string) {
  // ensure the result path is a child of the base path
  const resolvedPath = path.resolve(base, relative);
  if (!resolvedPath.startsWith(base)) {
    throw new Error(`Invalid path: ${relative} is not a child of ${base}`);
  }
  return resolvedPath;
}
