import { GEMINI_LIVE_SYSTEM_PROMPT } from "@/lib/llm/prompts";

const GEMINI_LIVE_API_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;

interface GeminiLiveConfig {
  projectId: string;
  accessToken: string;
  onAudioChunk: (audioData: ArrayBuffer) => void;
  onTranscription: (text: string) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${GEMINI_LIVE_API_URL}?key=${this.config.accessToken}`;

      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        // Send setup message
        this.sendJSON({
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
        });
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            this.handleMessage(msg);
          } catch (e) {
            console.error("Failed to parse Gemini Live message:", e);
          }
        } else if (event.data instanceof ArrayBuffer) {
          this.config.onAudioChunk(event.data);
        }
      };

      this.ws.onerror = (event) => {
        const error = new Error("Gemini Live WebSocket error");
        this.config.onError(error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.config.onClose();
      };
    });
  }

  private handleMessage(msg: Record<string, unknown>) {
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
              this.config.onTranscription(part.text);
            }
            if (part.inlineData?.data) {
              const binaryStr = atob(part.inlineData.data);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              this.config.onAudioChunk(bytes.buffer);
            }
          }
        }
      }
    }
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const bytes = new Uint8Array(audioData);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    this.sendJSON({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: "audio/pcm;rate=16000",
            data: base64,
          },
        ],
      },
    });
  }

  private sendJSON(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
