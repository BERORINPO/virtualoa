import WsModule, { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import { IncomingMessage } from "http";
import { startTranscribeStream, synthesizeSpeech } from "../voice/aws-pipeline";
import { generateChatResponse } from "../llm/gemini-client";
import { GEMINI_LIVE_SYSTEM_PROMPT } from "../llm/prompts";
import type { ChatMessage, WebSocketMessage, VoiceMode } from "../../types";

interface ClientState {
  ws: WsWebSocket;
  mode: VoiceMode;
  isStreaming: boolean;
  conversationHistory: ChatMessage[];
  audioStreamController: ReadableStreamDefaultController<Uint8Array> | null;
  geminiWs: WsModule | null;
  audioBuffer: Uint8Array[];
}

export function createWebSocketServer(port: number = 3001): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws: WsWebSocket, _req: IncomingMessage) => {
    console.log("Client connected");

    const state: ClientState = {
      ws,
      mode: "aws",
      isStreaming: false,
      conversationHistory: [],
      audioStreamController: null,
      geminiWs: null,
      audioBuffer: [],
    };

    ws.on("message", async (data: Buffer) => {
      try {
        // Try to parse as JSON first
        const textData = data.toString("utf-8");
        let message: WebSocketMessage;

        try {
          message = JSON.parse(textData);
        } catch {
          // Binary audio data
          handleAudioChunk(state, new Uint8Array(data));
          return;
        }

        switch (message.type) {
          case "start-listening": {
            const msgData = message.data as { mode?: VoiceMode } | undefined;
            state.mode = msgData?.mode || "aws";
            console.log(`Starting ${state.mode} mode`);

            if (state.mode === "gemini-live") {
              await startGeminiLiveListening(state);
            } else {
              await startAWSListening(state);
            }
            break;
          }
          case "stop-listening":
            stopListening(state);
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
        sendMessage(ws, {
          type: "error",
          data: String(error instanceof Error ? error.message : error),
        });
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      stopListening(state);
    });
  });

  console.log(`WebSocket server running on port ${port}`);
  return wss;
}

function handleAudioChunk(state: ClientState, audioData: Uint8Array) {
  if (state.mode === "gemini-live" && state.geminiWs) {
    // Forward audio to Gemini Live API
    sendGeminiAudio(state.geminiWs, audioData);
  } else if (state.audioStreamController) {
    // Forward audio to AWS Transcribe
    state.audioStreamController.enqueue(audioData);
  }
}

// ========== AWS Mode ==========

async function startAWSListening(state: ClientState) {
  if (state.isStreaming) return;
  state.isStreaming = true;

  const audioStream = new ReadableStream<Uint8Array>({
    start(controller) {
      state.audioStreamController = controller;
    },
    cancel() {
      state.audioStreamController = null;
    },
  });

  async function* streamToAsyncIterable(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  try {
    await startTranscribeStream(
      streamToAsyncIterable(audioStream),
      async (text: string, isFinal: boolean) => {
        sendMessage(state.ws, {
          type: "transcription",
          data: { text, isFinal },
        });

        if (isFinal && text.trim()) {
          await processTextResponse(state, text);
        }
      }
    );
  } catch (error) {
    console.error("Transcribe stream error:", error);
    sendMessage(state.ws, {
      type: "error",
      data: "音声認識エラー: " + (error instanceof Error ? error.message : String(error)),
    });
  }
}

// ========== Gemini Live Mode ==========

async function startGeminiLiveListening(state: ClientState) {
  if (state.isStreaming) return;
  state.isStreaming = true;

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    // Fallback: use Gemini text API + Polly TTS (same as AWS mode but without Transcribe)
    console.log("No GEMINI_API_KEY set, falling back to text pipeline with Web Speech API hint");
    sendMessage(state.ws, {
      type: "error",
      data: "Gemini Live APIキーが未設定です。AWSモードを使用してください。\n(.env.local に GEMINI_API_KEY を設定)",
    });
    state.isStreaming = false;
    return;
  }

  try {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const geminiWs = new WsModule(wsUrl);
    state.geminiWs = geminiWs;

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Gemini Live API接続タイムアウト"));
      }, 10000);

      geminiWs.on("open", () => {
        clearTimeout(timeout);

        // Send setup message
        const setup = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede",
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: GEMINI_LIVE_SYSTEM_PROMPT }],
            },
          },
        };
        geminiWs.send(JSON.stringify(setup));
        console.log("Gemini Live setup sent");
        resolve();
      });

      geminiWs.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    geminiWs.on("message", (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        handleGeminiLiveMessage(state, msg);
      } catch (e) {
        console.error("Failed to parse Gemini Live message:", e);
      }
    });

    geminiWs.on("close", () => {
      console.log("Gemini Live connection closed");
      state.geminiWs = null;
    });

    geminiWs.on("error", (err) => {
      console.error("Gemini Live error:", err);
      sendMessage(state.ws, {
        type: "error",
        data: "Gemini Live エラー: " + err.message,
      });
    });
  } catch (error) {
    console.error("Gemini Live connection failed:", error);
    sendMessage(state.ws, {
      type: "error",
      data: "Gemini Live接続失敗: " + (error instanceof Error ? error.message : String(error)),
    });
    state.isStreaming = false;
  }
}

function sendGeminiAudio(geminiWs: WsModule, audioData: Uint8Array) {
  if (geminiWs.readyState !== WsModule.OPEN) return;

  const base64 = Buffer.from(audioData).toString("base64");

  const msg = {
    realtimeInput: {
      mediaChunks: [
        {
          mimeType: "audio/pcm;rate=16000",
          data: base64,
        },
      ],
    },
  };
  geminiWs.send(JSON.stringify(msg));
}

function handleGeminiLiveMessage(
  state: ClientState,
  msg: Record<string, unknown>
) {
  if (msg.serverContent) {
    const content = msg.serverContent as Record<string, unknown>;

    if (content.modelTurn) {
      const modelTurn = content.modelTurn as {
        parts?: Array<{
          text?: string;
          inlineData?: { data: string; mimeType: string };
        }>;
      };

      if (modelTurn.parts) {
        for (const part of modelTurn.parts) {
          if (part.text) {
            sendMessage(state.ws, {
              type: "response-text",
              data: { text: part.text, emotion: "neutral" },
            });
          }
          if (part.inlineData?.data) {
            // Forward audio to client
            sendMessage(state.ws, {
              type: "response-audio",
              data: part.inlineData.data,
            });
          }
        }
      }
    }
  }
}

// ========== Shared ==========

async function processTextResponse(state: ClientState, text: string) {
  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: text,
    timestamp: Date.now(),
  };
  state.conversationHistory.push(userMessage);

  try {
    const responseText = await generateChatResponse(
      text,
      state.conversationHistory.slice(-20)
    );

    const emotionMatch = responseText.match(/\[emotion:\s*(\w+)\]/);
    const emotion = emotionMatch ? emotionMatch[1] : "neutral";
    const cleanText = responseText.replace(/\[emotion:\s*\w+\]\s*/g, "");

    sendMessage(state.ws, {
      type: "response-text",
      data: { text: cleanText, emotion },
    });

    sendMessage(state.ws, { type: "emotion", data: emotion });

    const aiMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: cleanText,
      timestamp: Date.now(),
    };
    state.conversationHistory.push(aiMessage);

    // Synthesize speech with Polly
    const audioBuffer = await synthesizeSpeech(cleanText);
    sendMessage(state.ws, {
      type: "response-audio",
      data: audioBuffer.toString("base64"),
    });
  } catch (error) {
    console.error("Response generation error:", error);
    sendMessage(state.ws, {
      type: "error",
      data: "応答生成エラー: " + (error instanceof Error ? error.message : String(error)),
    });
  }
}

function stopListening(state: ClientState) {
  state.isStreaming = false;

  if (state.audioStreamController) {
    try {
      state.audioStreamController.close();
    } catch { /* Already closed */ }
    state.audioStreamController = null;
  }

  if (state.geminiWs) {
    try {
      state.geminiWs.close();
    } catch { /* Already closed */ }
    state.geminiWs = null;
  }
}

function sendMessage(ws: WsWebSocket, message: WebSocketMessage) {
  if (ws.readyState === WsWebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}
