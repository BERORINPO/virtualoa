"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { VoiceMode, ChatMessage, Emotion } from "@/types";
import {
  float32ToInt16,
  downsampleBuffer,
  calculateVolume,
} from "@/lib/voice/audio-utils";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface UseVoiceChatOptions {
  mode: VoiceMode;
  onMessage: (message: ChatMessage) => void;
  onEmotionChange: (emotion: Emotion) => void;
  onVolumeChange: (volume: number) => void;
  onSpeakingChange: (isSpeaking: boolean) => void;
}

export function useVoiceChat({
  mode,
  onMessage,
  onEmotionChange,
  onVolumeChange,
  onSpeakingChange,
}: UseVoiceChatOptions) {
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSpeakingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef("");

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanup = () => {
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    pendingTextRef.current = "";
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "stop-listening" }));
        }
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    window.speechSynthesis?.cancel();
  };

  // ========== Browser Mode (Web Speech API - no API keys needed) ==========

  const startBrowserMode = useCallback(async () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("このブラウザは音声認識に対応していません。\nGoogle Chromeを使用してください。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ja-JP";
    recognitionRef.current = recognition;

    const sendToAI = async (text: string) => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      onMessage(userMsg);
      messagesRef.current = [...messagesRef.current, userMsg];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messagesRef.current.slice(-20),
          }),
        });

        if (!res.ok) throw new Error("API error");

        const data = await res.json();
        const emotionMatch = data.response.match(/\[emotion:\s*(\w+)\]/);
        const emotion = (emotionMatch ? emotionMatch[1] : "neutral") as Emotion;
        const cleanText = data.response.replace(/\[emotion:\s*\w+\]\s*/g, "");

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: cleanText,
          emotion,
          timestamp: Date.now(),
        };
        onMessage(aiMsg);
        messagesRef.current = [...messagesRef.current, aiMsg];
        onEmotionChange(emotion);

        speakText(cleanText);
      } catch (error) {
        console.error("Chat API error:", error);
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "ごめんね、エラーが起きちゃった…",
          emotion: "sad",
          timestamp: Date.now(),
        };
        onMessage(errMsg);
        onEmotionChange("sad");
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (isSpeakingRef.current) return;

      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript.trim();
      if (!transcript) return;

      if (lastResult.isFinal) {
        // Accumulate final text and wait for silence before sending
        pendingTextRef.current += (pendingTextRef.current ? " " : "") + transcript;

        // Reset the silence timer - wait 1.2s of silence after last final result
        if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
        sendTimerRef.current = setTimeout(() => {
          const fullText = pendingTextRef.current.trim();
          pendingTextRef.current = "";
          sendTimerRef.current = null;
          if (fullText) {
            sendToAI(fullText);
          }
        }, 1200);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        alert("音声認識エラー: " + event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening
      if (recognitionRef.current && !isSpeakingRef.current) {
        try {
          recognition.start();
        } catch { /* ignore */ }
      }
    };

    recognition.start();
    setIsListening(true);
  }, [onMessage, onEmotionChange]);

  const speakText = (text: string) => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";

    // Find the best Japanese female voice available
    const voices = synth.getVoices();
    const jaVoices = voices.filter((v) => v.lang.startsWith("ja"));

    // Priority: neural/online voices > local voices
    // Windows: "Microsoft Nanami Online" (neural, very natural)
    // Chrome:  "Google 日本語"
    // Mac:     "Kyoko" or "O-Ren"
    const preferredNames = [
      "nanami",   // Windows neural (best quality)
      "haruka",   // Windows neural
      "google",   // Chrome built-in
      "kyoko",    // macOS
      "o-ren",    // macOS
    ];

    let bestVoice: SpeechSynthesisVoice | null = null;

    // First: try preferred voices in priority order
    for (const name of preferredNames) {
      const found = jaVoices.find(
        (v) => v.name.toLowerCase().includes(name)
      );
      if (found) {
        bestVoice = found;
        break;
      }
    }

    // Fallback: any online/remote Japanese voice (usually higher quality)
    if (!bestVoice) {
      bestVoice = jaVoices.find((v) => !v.localService) || jaVoices[0] || null;
    }

    if (bestVoice) {
      utterance.voice = bestVoice;
      // Tune parameters based on voice type
      if (bestVoice.name.toLowerCase().includes("nanami") ||
          bestVoice.name.toLowerCase().includes("haruka")) {
        // Neural voices sound best at natural speed
        utterance.rate = 1.05;
        utterance.pitch = 1.05;
      } else {
        // Non-neural voices: slightly higher pitch for feminine feel
        utterance.rate = 1.1;
        utterance.pitch = 1.15;
      }
    } else {
      utterance.rate = 1.1;
      utterance.pitch = 1.15;
    }

    // Stop recognition while AI is speaking to prevent echo feedback
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      onSpeakingChange(true);
      // Simulate volume for lip sync
      const interval = setInterval(() => {
        onVolumeChange(30 + Math.random() * 70);
      }, 100);
      utterance.onend = () => {
        clearInterval(interval);
        isSpeakingRef.current = false;
        onSpeakingChange(false);
        onVolumeChange(0);
        // Restart recognition after AI finishes speaking
        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* ignore */ }
        }
      };
    };

    synth.speak(utterance);
  };

  // ========== WebSocket Mode (AWS / Gemini Live) ==========

  const startWSMode = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocketサーバーに接続できません。\nnpm run dev:ws を実行してください。"));
        }, 5000);
        ws.onopen = () => { clearTimeout(timeout); resolve(); };
        ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("WebSocketサーバーに接続できません。\nnpm run dev:ws を実行してください。"));
        };
      });

      ws.send(JSON.stringify({ type: "start-listening", data: { mode } }));

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "transcription":
              if (msg.data.isFinal) {
                onMessage({
                  id: crypto.randomUUID(),
                  role: "user",
                  content: msg.data.text,
                  timestamp: Date.now(),
                });
              }
              break;
            case "response-text":
              onMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                content: msg.data.text,
                emotion: msg.data.emotion as Emotion,
                timestamp: Date.now(),
              });
              break;
            case "emotion":
              onEmotionChange(msg.data as Emotion);
              break;
            case "response-audio":
              playBase64Audio(msg.data, audioContext);
              break;
            case "error":
              console.error("Server error:", msg.data);
              alert("エラー: " + msg.data);
              cleanup();
              setIsListening(false);
              break;
          }
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      ws.onclose = () => {
        setIsListening(false);
        onVolumeChange(0);
      };

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        onVolumeChange(calculateVolume(inputData));
        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
        const pcm = float32ToInt16(downsampled);
        ws.send(pcm.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsListening(true);
    } catch (error) {
      cleanup();
      const message = error instanceof Error ? error.message : "音声接続に失敗しました";
      alert(message);
    }
  }, [mode, onMessage, onEmotionChange, onVolumeChange, onSpeakingChange]);

  const playBase64Audio = (base64Data: string, audioContext: AudioContext) => {
    onSpeakingChange(true);
    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const audioBuffer = audioContext.createBuffer(1, bytes.length / 2, 16000);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768;
    }

    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    bufferSource.connect(analyser);
    analyser.connect(audioContext.destination);

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    const monitorInterval = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);
      onVolumeChange(calculateVolume(dataArray));
    }, 50);

    bufferSource.onended = () => {
      clearInterval(monitorInterval);
      onVolumeChange(0);
      onSpeakingChange(false);
    };

    bufferSource.start();
  };

  // ========== Controls ==========

  const startListening = useCallback(async () => {
    if (mode === "browser") {
      await startBrowserMode();
    } else {
      await startWSMode();
    }
  }, [mode, startBrowserMode, startWSMode]);

  const stopListening = useCallback(() => {
    cleanup();
    setIsListening(false);
    onVolumeChange(0);
  }, [onVolumeChange]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    startListening,
    stopListening,
    toggleListening,
  };
}
