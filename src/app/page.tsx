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
    <main className="relative h-screen w-screen flex">
      {/* 3D Avatar Area */}
      <div className="flex-1 relative">
        <VRMViewer
          emotion={currentEmotion}
          isTalking={isSpeaking}
          volume={volume}
        />

        {/* Voice Control - bottom center of avatar area */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
          <VoiceControl
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListening={toggleListening}
          />
        </div>
      </div>

      {/* Chat Panel - right side */}
      <div className="w-96 h-full border-l border-white/10">
        <ChatPanel messages={messages} onSendMessage={handleSendMessage} />
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
