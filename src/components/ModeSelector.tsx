"use client";

import type { VoiceMode } from "@/types";

interface ModeSelectorProps {
  mode: VoiceMode;
  onModeChange: (mode: VoiceMode) => void;
}

const MODES: { value: VoiceMode; label: string; color: string }[] = [
  { value: "browser", label: "ブラウザ", color: "bg-green-500" },
  { value: "aws", label: "AWS", color: "bg-pink-500" },
  { value: "gemini-live", label: "Gemini Live", color: "bg-purple-500" },
];

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex bg-white/10 rounded-full p-1 backdrop-blur-sm">
      {MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => onModeChange(m.value)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            mode === m.value
              ? `${m.color} text-white`
              : "text-white/60 hover:text-white"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
