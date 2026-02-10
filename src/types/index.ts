export type Emotion = "happy" | "surprised" | "shy" | "sad" | "neutral" | "angry";

export type VoiceMode = "browser" | "aws" | "gemini-live";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  emotion?: Emotion;
  timestamp: number;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  mode: VoiceMode;
}

export interface AvatarState {
  currentEmotion: Emotion;
  isTalking: boolean;
  volume: number;
}

export interface WebSocketMessage {
  type:
    | "audio-chunk"
    | "transcription"
    | "response-text"
    | "response-audio"
    | "emotion"
    | "error"
    | "start-listening"
    | "stop-listening";
  data: unknown;
}
