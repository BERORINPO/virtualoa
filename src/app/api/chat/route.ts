import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/lib/llm/gemini-client";
import type { ChatMessage } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body as {
      message: string;
      history: ChatMessage[];
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const response = await generateChatResponse(message, history || []);

    return NextResponse.json({ response });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
