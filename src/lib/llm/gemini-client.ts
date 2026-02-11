import { GIRLFRIEND_SYSTEM_PROMPT } from "./prompts";
import { getEnvVar } from "../env";
import type { ChatMessage } from "../../types";

const MODEL = "gemini-2.0-flash";

export async function generateChatResponse(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const apiKey = getEnvVar("GEMINI_API_KEY");
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ALLOWED_ORIGIN && { Referer: process.env.ALLOWED_ORIGIN }),
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: GIRLFRIEND_SYSTEM_PROMPT }],
      },
      contents,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_CIVIC_INTEGRITY", threshold: "BLOCK_NONE" },
      ],
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${error}`);
  }

  const data = await res.json();

  // Check if response was blocked by safety filters
  const candidate = data.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    return "[emotion: shy] えへへ、ちょっと恥ずかしいな…もう一回言ってくれる？";
  }

  const text =
    candidate?.content?.parts?.[0]?.text ||
    "[emotion: neutral] ...";

  return text;
}
