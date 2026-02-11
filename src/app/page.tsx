"use client";

import { useState, useCallback, useRef } from "react";
import { VRMViewer } from "@/components/VRMViewer";
import { ChatPanel } from "@/components/ChatPanel";
import { VoiceControl } from "@/components/VoiceControl";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import type { ChatMessage, Emotion } from "@/types";

interface AvatarEntry {
  name: string;
  url: string;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>("neutral");
  const [volume, setVolume] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [avatars, setAvatars] = useState<AvatarEntry[]>([
    { name: "デフォルト", url: "/models/girlfriend.vrm" },
  ]);
  const [currentAvatarIndex, setCurrentAvatarIndex] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleVRMUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".vrm")) return;

    const url = URL.createObjectURL(file);
    const name = file.name.replace(".vrm", "");
    setAvatars((prev) => {
      const next = [...prev, { name, url }];
      setCurrentAvatarIndex(next.length - 1);
      return next;
    });
    setAvatarMenuOpen(false);
    e.target.value = "";
  }, []);

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
          vrmUrl={avatars[currentAvatarIndex]?.url || "/models/girlfriend.vrm"}
        />

        {/* Top bar: Avatar selector (left) + Chat toggle (right) */}
        <div className="absolute top-4 sm:top-6 left-4 sm:left-6 right-4 sm:right-6 z-20 flex items-start justify-between">
          {/* Avatar selector */}
          <div className="relative">
            <button
              onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
              className="bg-white/10 backdrop-blur-sm rounded-full p-3 sm:p-3.5 text-white/80 hover:text-white hover:bg-white/20 transition-all"
              title="アバター切り替え"
            >
              <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {avatarMenuOpen && (
              <div className="absolute top-full mt-2 left-0 bg-black/80 backdrop-blur-md rounded-xl border border-white/10 p-2 min-w-[200px] sm:min-w-[220px]">
                <p className="text-xs sm:text-sm text-white/40 px-2 py-1">アバター選択</p>
                {avatars.map((avatar, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentAvatarIndex(i);
                      setAvatarMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm sm:text-base transition-colors ${
                      i === currentAvatarIndex
                        ? "bg-pink-500/30 text-pink-300"
                        : "text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {avatar.name}
                  </button>
                ))}
                <hr className="border-white/10 my-1" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm sm:text-base text-white/70 hover:bg-white/10 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  VRMファイルを追加
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vrm"
                  onChange={handleVRMUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Mobile: Chat toggle button */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="lg:hidden relative bg-white/10 backdrop-blur-sm rounded-full p-3 sm:p-3.5 text-white/80 hover:text-white hover:bg-white/20 transition-all"
          >
            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {chatOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              )}
            </svg>
            {messages.length > 0 && !chatOpen && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-[10px] font-bold flex items-center justify-center">
                {messages.length}
              </span>
            )}
          </button>
        </div>

        {/* Voice Control - bottom center */}
        <div className="absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 sm:gap-3 z-10">
          <VoiceControl
            isListening={isListening}
            isSpeaking={isSpeaking}
            onToggleListening={toggleListening}
          />
        </div>
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
