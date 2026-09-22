"use client";

import { desk } from "@/lib/ui/desk";
import {
  appendTranscript,
  pickBestTranscript,
  TRADING_VOICE_GRAMMAR,
} from "@/lib/trades/voice-transcript";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars?: unknown;
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
    length: number;
    [index: number]: { transcript: string };
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

function attachTradingGrammar(recognition: SpeechRecognitionLike) {
  const speechWindow = window as Window & {
    SpeechGrammarList?: new () => {
      addFromString: (grammar: string, weight?: number) => void;
    };
    webkitSpeechGrammarList?: new () => {
      addFromString: (grammar: string, weight?: number) => void;
    };
  };
  const GrammarList =
    speechWindow.SpeechGrammarList ?? speechWindow.webkitSpeechGrammarList;
  if (!GrammarList) return;
  const list = new GrammarList();
  list.addFromString(TRADING_VOICE_GRAMMAR, 1);
  recognition.grammars = list;
}

function alternativesFor(
  result: SpeechRecognitionEventLike["results"][number]
): string[] {
  const texts: string[] = [];
  for (let index = 0; index < result.length; index += 1) {
    const text = result[index]?.transcript?.trim();
    if (text) texts.push(text);
  }
  return texts;
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
  const committedRef = useRef("");
  const sessionFinalRef = useRef("");
  const interimRef = useRef("");
  const processedIndexRef = useRef(0);
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
    interimRef.current = interim;
    onChange(
      appendTranscript(
        appendTranscript(committedRef.current, sessionFinalRef.current),
        interim
      )
    );
  };

  const commitSession = () => {
    const pending = appendTranscript(
      sessionFinalRef.current,
      interimRef.current
    );
    committedRef.current = appendTranscript(committedRef.current, pending);
    sessionFinalRef.current = "";
    interimRef.current = "";
    processedIndexRef.current = 0;
    publish();
  };

  const stop = () => {
    listeningRef.current = false;
    setListening(false);
    commitSession();
    recognitionRef.current?.stop();
  };

  const attachHandlers = (recognition: SpeechRecognitionLike) => {
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    attachTradingGrammar(recognition);

    recognition.onresult = (event) => {
      if (event.results.length < processedIndexRef.current) {
        processedIndexRef.current = 0;
      }
      let interim = "";
      const start = Math.max(event.resultIndex, processedIndexRef.current);

      for (let index = start; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = pickBestTranscript(alternativesFor(result));
        if (!transcript) continue;

        if (result.isFinal) {
          sessionFinalRef.current = appendTranscript(
            sessionFinalRef.current,
            transcript
          );
          processedIndexRef.current = index + 1;
        } else {
          interim = appendTranscript(interim, transcript);
        }
      }

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
      commitSession();
      if (!listeningRef.current) {
        setListening(false);
        return;
      }

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
      }, 120);
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
    committedRef.current = value.trim();
    sessionFinalRef.current = "";
    interimRef.current = "";
    processedIndexRef.current = 0;
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
        onChange={(event) => {
          if (listeningRef.current) {
            committedRef.current = event.target.value.trim();
            sessionFinalRef.current = "";
            interimRef.current = "";
          }
          onChange(event.target.value);
        }}
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
