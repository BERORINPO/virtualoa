"use client";

interface VoiceControlProps {
  isListening: boolean;
  isSpeaking: boolean;
  onToggleListening: () => void;
}

export function VoiceControl({
  isListening,
  isSpeaking,
  onToggleListening,
}: VoiceControlProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Status text */}
      <span className="text-sm sm:text-base text-white/60">
        {isSpeaking
          ? "あいが話しています..."
          : isListening
            ? "聞いています..."
            : "マイクボタンで会話開始"}
      </span>

      {/* Mic button */}
      <button
        onClick={onToggleListening}
        disabled={isSpeaking}
        className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all ${
          isListening
            ? "bg-red-500 hover:bg-red-600 scale-110"
            : "bg-pink-500 hover:bg-pink-600"
        } ${isSpeaking ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {/* Pulse ring when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-full bg-red-500/50 animate-pulse-ring" />
        )}

        {/* Mic icon */}
        <svg
          className="w-8 h-8 sm:w-9 sm:h-9 text-white relative z-10"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {isListening ? (
            // Stop icon
            <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
          ) : (
            // Mic icon
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 10v2a7 7 0 01-14 0v-2"
              />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
