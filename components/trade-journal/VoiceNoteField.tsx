"use client";

import { desk } from "@/lib/ui/desk";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getSpeechRecognition():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

type VoiceNoteFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
};

export function VoiceNoteField({
  id = "notes",
  label = "Notes",
  value,
  onChange,
  placeholder = "Setup rationale, emotions, lessons learned...",
  rows = 5,
}: VoiceNoteFieldProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggle = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setSupported(false);
      setError("Voice-to-text is not supported in this browser.");
      return;
    }

    if (listening) {
      stop();
      return;
    }

    setError(null);
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    let committed = value;
    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;
        if (result.isFinal) {
          committed = committed.trim()
            ? `${committed.trim()} ${transcript}`
            : transcript;
        } else {
          interim = transcript;
        }
      }
      onChange(interim ? `${committed}${committed ? " " : ""}${interim}` : committed);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone permission was denied.");
      } else if (event.error && event.error !== "aborted") {
        setError("Voice capture stopped. You can keep typing.");
      }
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Unable to start voice capture.");
      setListening(false);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className={desk.label}>
          {label}
        </label>
        <button
          type="button"
          onClick={toggle}
          disabled={!supported}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
            listening
              ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
              : "border-white/10 bg-white/5 text-zinc-400 hover:border-indigo-400/40 hover:text-zinc-100"
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {listening ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {listening ? "Stop" : "Voice"}
        </button>
      </div>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${desk.input} resize-none`}
      />
      <p className="mt-1.5 text-xs text-zinc-500">
        {listening
          ? "Listening… speak your reflection and it will transcribe into the note."
          : supported
            ? "Type freely, or use voice-to-text to dictate the review."
            : "Voice-to-text is unavailable here — type the note instead."}
      </p>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
