import { GoogleGenAI } from "@google/genai";

export async function generateScript(prompt: string) {
  const ai = new GoogleGenAI({});

  const interaction = await ai.interactions.create({
    model: "gemini-3.7-flash",
    system_instruction: `Follow user\'s instructions to write a javascript function:
    
async function main() {
  // ...your code must return the output
}
  
Respond with raw js code and nothing else`,
    input: prompt,
    generation_config: {
      thinking_summaries: "none",
      thinking_level: "low",
    },
  });

  return interaction.output_text;
}
