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

function joinNotes(...parts: string[]) {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
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
  const listeningRef = useRef(false);
  const baseTextRef = useRef("");
  const finalTextRef = useRef("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  const publish = (interim = "") => {
    onChange(joinNotes(baseTextRef.current, finalTextRef.current, interim));
  };

  const stop = () => {
    listeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
  };

  const attachHandlers = (recognition: SpeechRecognitionLike) => {
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let sessionFinals = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;
        if (result.isFinal) {
          sessionFinals = joinNotes(sessionFinals, transcript);
        } else {
          interim = joinNotes(interim, transcript);
        }
      }
      finalTextRef.current = sessionFinals;
      publish(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed") {
        setError("Microphone permission was denied.");
        listeningRef.current = false;
        setListening(false);
        return;
      }
      setError("Voice capture hit a pause — keep talking, it will continue.");
    };

    recognition.onend = () => {
      if (!listeningRef.current) {
        setListening(false);
        return;
      }

      baseTextRef.current = joinNotes(baseTextRef.current, finalTextRef.current);
      finalTextRef.current = "";
      publish();

      window.setTimeout(() => {
        if (!listeningRef.current || recognitionRef.current !== recognition) {
          return;
        }
        try {
          recognition.start();
        } catch {
          listeningRef.current = false;
          setListening(false);
        }
      }, 80);
    };
  };

  const toggle = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setSupported(false);
      setError("Voice-to-text is not supported in this browser.");
      return;
    }

    if (listeningRef.current) {
      stop();
      return;
    }

    setError(null);
    baseTextRef.current = value.trim();
    finalTextRef.current = "";
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    attachHandlers(recognition);

    try {
      listeningRef.current = true;
      setListening(true);
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setError("Unable to start voice capture.");
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
              : "border-white/10 bg-white/5 text-zinc-300 hover:border-indigo-400/40 hover:text-zinc-100"
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
      <p className="mt-1.5 text-xs text-zinc-400">
        {listening
          ? "Listening… each sentence is appended. Keep talking or press Stop."
          : supported
            ? "Type freely, or use voice-to-text to dictate the review."
            : "Voice-to-text is unavailable here — type the note instead."}
      </p>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
