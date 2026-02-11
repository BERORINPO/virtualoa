"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onClose?: () => void;
}

export function ChatPanel({ messages, onSendMessage, onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-black/30 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pink-300">
            あい とのチャット
          </h2>
          <p className="text-xs text-white/50">AI Girlfriend</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-white/50 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-white/30 mt-8">
            <p className="text-sm">あいに話しかけてみてね！</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-pink-500/30 text-white rounded-br-sm"
                  : "bg-white/10 text-white/90 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="メッセージを入力..."
            className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-pink-500/50"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-pink-500 hover:bg-pink-600 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            送信
          </button>
        </div>
      </form>
    </div>
  );
}
