import { GIRLFRIEND_SYSTEM_PROMPT } from "./prompts";
import type { ChatMessage } from "../../types";

const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = "gemini-2.0-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

export async function generateChatResponse(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  if (!API_KEY || API_KEY === "your-gemini-api-key") {
    throw new Error("GEMINI_API_KEY が設定されていません。.env.local に設定してください。");
  }

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: message }] },
  ];

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: GIRLFRIEND_SYSTEM_PROMPT }],
      },
      contents,
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
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
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "[emotion: neutral] ...";

  return text;
}
