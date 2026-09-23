"use client";

import { DEFAULT_BROWSER_VOICE_LANG } from "@/lib/ai/transcribe";
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

const SLICE_MS = 5500;

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
  if (recognition.lang.toLowerCase().startsWith("ar")) return;
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

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

async function transcribeBlob(blob: Blob): Promise<{
  text: string;
  fallback: boolean;
}> {
  const body = new FormData();
  const name = blob.type.includes("mp4")
    ? "note.m4a"
    : blob.type.includes("ogg")
      ? "note.ogg"
      : "note.webm";
  body.append("file", blob, name);
  const response = await fetch("/api/ai/transcribe", {
    method: "POST",
    body,
  });
  const data = (await response.json()) as {
    ok?: boolean;
    text?: string;
    fallback?: boolean;
  };
  if (response.status === 503 || data.fallback) {
    return { text: "", fallback: true };
  }
  if (!response.ok) {
    throw new Error("transcription_failed");
  }
  return { text: String(data.text ?? "").trim(), fallback: false };
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
  placeholder = "Dictate in Lebanese, Arabizi, or English — setup, emotions, lessons...",
  rows = 5,
}: VoiceNoteFieldProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sliceTimerRef = useRef<number | null>(null);
  const transcribeChain = useRef(Promise.resolve());
  const listeningRef = useRef(false);
  const committedRef = useRef("");
  const sessionFinalRef = useRef("");
  const interimRef = useRef("");
  const processedIndexRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [supported, setSupported] = useState(true);
  const [whisperReady, setWhisperReady] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canRecord =
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined";
    setSupported(canRecord || Boolean(getSpeechRecognition()));
    void fetch("/api/ai/transcribe")
      .then((response) => response.json())
      .then((data: { enabled?: boolean }) => {
        setWhisperReady(Boolean(data.enabled));
      })
      .catch(() => {
        setWhisperReady(false);
      });
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.abort();
      stopRecorder(true);
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

  const appendFinal = (text: string) => {
    sessionFinalRef.current = appendTranscript(sessionFinalRef.current, text);
    publish();
  };

  function stopRecorder(immediate = false) {
    if (sliceTimerRef.current) {
      window.clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    recorderRef.current = null;
    if (immediate) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  const queueTranscribe = (blob: Blob) => {
    transcribeChain.current = transcribeChain.current
      .then(async () => {
        if (blob.size < 800) return;
        setTranscribing(true);
        const result = await transcribeBlob(blob);
        if (result.fallback) {
          setWhisperReady(false);
          if (listeningRef.current) startBrowserRecognition();
          return;
        }
        if (result.text) appendFinal(result.text);
      })
      .catch(() => {
        setError("Voice capture hit a pause — keep talking, it will continue.");
      })
      .finally(() => {
        setTranscribing(false);
      });
    return transcribeChain.current;
  };

  const startSlice = (stream: MediaStream) => {
    if (!listeningRef.current) return;
    const mime = pickRecorderMime();
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      if (recorderRef.current === recorder) recorderRef.current = null;
      const blob = new Blob(chunks, {
        type: recorder.mimeType || mime || "audio/webm",
      });
      void queueTranscribe(blob);
      if (listeningRef.current) startSlice(stream);
    };
    recorderRef.current = recorder;
    recorder.start();
    sliceTimerRef.current = window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, SLICE_MS);
  };

  const startWhisperCapture = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
    streamRef.current = stream;
    startSlice(stream);
  };

  const attachHandlers = (recognition: SpeechRecognitionLike) => {
    recognition.lang = DEFAULT_BROWSER_VOICE_LANG;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
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
      if (event.error === "language-not-supported") {
        recognition.lang = "ar";
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

  const startBrowserRecognition = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setSupported(false);
      setError("Voice-to-text is not supported in this browser.");
      listeningRef.current = false;
      setListening(false);
      return;
    }
    stopRecorder(true);
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    attachHandlers(recognition);
    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setError("Unable to start voice capture.");
    }
  };

  const stop = () => {
    listeningRef.current = false;
    setListening(false);
    recognitionRef.current?.stop();
    const recorder = recorderRef.current;
    if (sliceTimerRef.current) {
      window.clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        commitSession();
      }
    } else {
      commitSession();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const toggle = async () => {
    if (listeningRef.current) {
      stop();
      return;
    }

    setError(null);
    committedRef.current = value.trim();
    sessionFinalRef.current = "";
    interimRef.current = "";
    processedIndexRef.current = 0;
    listeningRef.current = true;
    setListening(true);

    if (whisperReady && navigator.mediaDevices) {
      try {
        await startWhisperCapture();
        return;
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "NotAllowedError") {
          setError("Microphone permission was denied.");
          listeningRef.current = false;
          setListening(false);
          return;
        }
      }
    }

    startBrowserRecognition();
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className={desk.label}>
          {label}
        </label>
        <button
          type="button"
          onClick={() => void toggle()}
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
        dir="auto"
        lang="ar"
        className={`${desk.input} resize-none`}
      />
      <p className="mt-1.5 text-xs text-zinc-400">
        {listening
          ? whisperReady
            ? "Listening for Lebanese, Arabizi, and English… keep talking or press Stop."
            : "Listening in Arabic (Lebanon)… keep talking or press Stop."
          : transcribing
            ? "Transcribing the last sentence…"
            : supported
              ? "Type freely, or dictate in Lebanese, Arabizi, or English."
              : "Voice-to-text is unavailable here — type the note instead."}
      </p>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
