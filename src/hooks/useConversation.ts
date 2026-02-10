"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatMessage } from "@/types";

export function useConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`conversation-${sessionId}`);
      if (stored) {
        setMessages(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, [sessionId]);

  // Save conversation to localStorage on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(`conversation-${sessionId}`, JSON.stringify(messages));
    }
  }, [messages, sessionId]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const sendTextMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            history: messages.slice(-20),
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        const emotionMatch = data.response.match(/\[emotion:\s*(\w+)\]/);

        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response.replace(/\[emotion:\s*\w+\]\s*/g, ""),
          emotion: emotionMatch ? emotionMatch[1] : "neutral",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        return aiMessage;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "ごめんね、ちょっとエラーが起きちゃった…もう一回話しかけてくれる？",
          emotion: "sad",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return errorMsg;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(`conversation-${sessionId}`);
  }, [sessionId]);

  return {
    messages,
    sessionId,
    isLoading,
    addMessage,
    sendTextMessage,
    clearMessages,
  };
}
