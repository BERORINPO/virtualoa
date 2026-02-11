"use client";

import { useState, useCallback } from "react";
import { VRMViewer } from "@/components/VRMViewer";
import { ChatPanel } from "@/components/ChatPanel";
import { VoiceControl } from "@/components/VoiceControl";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import type { ChatMessage, Emotion } from "@/types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [volume, setVolume] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const { isListening, toggleListening } = useVoiceChat({
    mode: "browser",
    onMessage: addMessage,
    onEmotionChange: setCurrentEmotion,
    onVolumeChange: setVolume,
    onSpeakingChange: setIsSpeaking,
  });

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            history: messages.slice(-20),
          }),
        });

        if (!res.ok) throw new Error("Chat API error");

        const data = await res.json();
        const emotion = extractEmotion(data.response);

        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response.replace(/\[emotion:\s*\w+\]\s*/g, ""),
          emotion: emotion,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setCurrentEmotion(emotion);
      } catch {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "ごめんね、ちょっとエラーが起きちゃった…もう一回話しかけてくれる？",
          emotion: "sad",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setCurrentEmotion("sad");
      }
    },
    [messages]
  );

  return (
    <main className="relative h-[100dvh] w-screen flex flex-col lg:flex-row overflow-hidden">
      {/* 3D Avatar Area */}
      <div className="flex-1 relative min-h-0">
        <VRMViewer
          emotion={currentEmotion}
          isTalking={isSpeaking}
          volume={volume}
        />

        {/* Voice Control - bottom center of avatar area */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 sm:gap-3 z-10">
          <VoiceControl
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListening={toggleListening}
          />
        </div>

        {/* Mobile: Chat toggle button */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="lg:hidden absolute top-4 right-4 z-20 bg-white/10 backdrop-blur-sm rounded-full p-2.5 text-white/80 hover:text-white hover:bg-white/20 transition-all"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {chatOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            )}
          </svg>
          {messages.length > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-[10px] flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>
      </div>

      {/* Chat Panel - mobile: overlay, desktop: side panel */}
      <div
        className={`
          lg:relative lg:w-96 lg:h-full lg:border-l lg:border-white/10 lg:translate-x-0 lg:block
          fixed inset-0 z-30 transition-transform duration-300 ease-in-out
          ${chatOpen ? "translate-x-0" : "translate-x-full"}
          lg:!translate-x-0 lg:!static lg:!inset-auto
        `}
      >
        {/* Mobile: semi-transparent backdrop */}
        <div
          className="lg:hidden absolute inset-0 bg-black/50"
          onClick={() => setChatOpen(false)}
        />
        <div className="relative h-full ml-auto w-full sm:w-96 lg:w-full">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            onClose={() => setChatOpen(false)}
          />
        </div>
      </div>
    </main>
  );
}

function extractEmotion(text: string): Emotion {
  const match = text.match(/\[emotion:\s*(\w+)\]/);
  if (match) {
    const emotion = match[1] as Emotion;
    const validEmotions: Emotion[] = [
      "happy",
      "surprised",
      "shy",
      "sad",
      "neutral",
      "angry",
    ];
    if (validEmotions.includes(emotion)) return emotion;
  }
  return "neutral";
}
