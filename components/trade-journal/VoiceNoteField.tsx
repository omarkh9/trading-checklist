"use client";

import { desk } from "@/lib/ui/desk";
import {
  longestTranscript,
  mergeSpoken,
  TRADING_VOICE_GRAMMAR,
} from "@/lib/trades/voice-transcript";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const ENGLISH_VOICE_LANGS = ["en-US", "en-GB"] as const;

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

function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/mp4",
    "audio/aac",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function fileNameFor(type: string) {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) {
    return "note.m4a";
  }
  if (type.includes("ogg")) return "note.ogg";
  return "note.webm";
}

async function transcribeBlob(blob: Blob): Promise<{
  text: string;
  fallback: boolean;
}> {
  const body = new FormData();
  body.append("file", blob, fileNameFor(blob.type));
  body.append("language", "en");
  const response = await fetch("/api/ai/transcribe", {
    method: "POST",
    body,
  });
  const data = (await response.json().catch(() => ({}))) as {
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
  placeholder = "Setup rationale, emotions, lessons learned...",
  rows = 5,
}: VoiceNoteFieldProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listeningRef = useRef(false);
  const startedWithRef = useRef("");
  const lockedRef = useRef("");
  const transcriptRef = useRef("");
  const interimRef = useRef("");
  const langIndexRef = useRef(0);
  const sessionRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [supported, setSupported] = useState(true);
  const [whisperReady, setWhisperReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canListen = Boolean(getSpeechRecognition());
    const canRecord =
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices) &&
      typeof MediaRecorder !== "undefined";
    setSupported(canListen || canRecord);
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
      sessionRef.current += 1;
      recognitionRef.current?.abort();
      stopMic();
    };
  }, []);

  const publish = (interim = "") => {
    interimRef.current = interim;
    onChange(mergeSpoken(transcriptRef.current, interim));
  };

  const commitText = (text: string) => {
    transcriptRef.current = mergeSpoken(transcriptRef.current, text);
    lockedRef.current = transcriptRef.current;
  };

  const settleInterim = () => {
    if (!interimRef.current) return;
    commitText(interimRef.current);
    interimRef.current = "";
    publish();
  };

  const lockSettledSpeech = () => {
    if (interimRef.current) {
      transcriptRef.current = mergeSpoken(
        transcriptRef.current,
        interimRef.current
      );
      interimRef.current = "";
    }
    lockedRef.current = transcriptRef.current;
    publish();
  };

  const capturedThisSession = () =>
    transcriptRef.current.trim() !== startedWithRef.current ||
    Boolean(interimRef.current.trim());

  function stopMic() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.requestData?.();
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  const finishRecording = async () => {
    settleInterim();
    const mime = recorderRef.current?.mimeType || chunksRef.current[0]?.type || "";
    const blob = new Blob(chunksRef.current, {
      type: mime || "audio/webm",
    });
    chunksRef.current = [];
    stopMic();
    if (blob.size < 200 || capturedThisSession()) {
      publish();
      return;
    }
    if (!whisperReady) {
      publish();
      return;
    }
    setTranscribing(true);
    try {
      const result = await transcribeBlob(blob);
      if (result.text) {
        commitText(result.text);
      } else if (result.fallback) {
        setWhisperReady(false);
      }
    } catch {
      setError("Voice capture hit a pause. Try again, or type the note.");
    } finally {
      setTranscribing(false);
      publish();
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices) return false;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });
    streamRef.current = stream;
    const mime = pickRecorderMime();
    const recorder = mime
      ? new MediaRecorder(stream, { mimeType: mime })
      : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorderRef.current = recorder;
    recorder.start(1000);
    return true;
  };

  const failVoiceLangs = () => {
    setError("Voice dictation is not available in this browser. Type the note instead.");
    listeningRef.current = false;
    setListening(false);
    stopMic();
  };

  const startBrowserRecognition = (langOverride?: string) => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return false;
    const lang =
      langOverride ??
      ENGLISH_VOICE_LANGS[langIndexRef.current] ??
      ENGLISH_VOICE_LANGS[0];

    lockSettledSpeech();
    const session = sessionRef.current + 1;
    sessionRef.current = session;

    const previous = recognitionRef.current;
    recognitionRef.current = null;
    if (previous) {
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      try {
        previous.abort();
      } catch {
        // Previous session already closed.
      }
    }

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    attachTradingGrammar(recognition);
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      if (session !== sessionRef.current) return;

      let finals = "";
      let interim = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = longestTranscript(alternativesFor(result));
        if (!transcript) continue;

        if (result.isFinal) {
          finals = mergeSpoken(finals, transcript);
        } else {
          interim = interim ? `${interim} ${transcript}` : transcript;
        }
      }

      transcriptRef.current = mergeSpoken(lockedRef.current, finals);
      publish(interim);
    };

    recognition.onerror = (event) => {
      if (session !== sessionRef.current) return;
      if (
        event.error === "no-speech" ||
        event.error === "aborted" ||
        event.error === "network"
      ) {
        lockSettledSpeech();
        return;
      }
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied.");
        listeningRef.current = false;
        setListening(false);
        stopMic();
        return;
      }
      if (event.error === "language-not-supported") {
        const nextIndex = langIndexRef.current + 1;
        const nextLang = ENGLISH_VOICE_LANGS[nextIndex];
        if (nextLang) {
          langIndexRef.current = nextIndex;
          window.setTimeout(() => {
            if (listeningRef.current && session === sessionRef.current) {
              startBrowserRecognition(nextLang);
            }
          }, 80);
          return;
        }
        failVoiceLangs();
        return;
      }
      setError("Voice capture hit a pause — keep talking, it will continue.");
    };

    recognition.onend = () => {
      if (session !== sessionRef.current) return;
      lockSettledSpeech();
      if (!listeningRef.current) {
        setListening(false);
        return;
      }
      window.setTimeout(() => {
        if (
          !listeningRef.current ||
          session !== sessionRef.current ||
          recognitionRef.current !== recognition
        ) {
          return;
        }
        try {
          recognition.start();
        } catch {
          startBrowserRecognition(recognition.lang);
        }
      }, 120);
    };

    try {
      recognition.start();
      return true;
    } catch {
      const nextIndex = langIndexRef.current + 1;
      const nextLang = ENGLISH_VOICE_LANGS[nextIndex];
      if (nextLang) {
        langIndexRef.current = nextIndex;
        return startBrowserRecognition(nextLang);
      }
      failVoiceLangs();
      return false;
    }
  };

  const stop = () => {
    listeningRef.current = false;
    sessionRef.current += 1;
    setListening(false);
    recognitionRef.current?.stop();
    void finishRecording();
  };

  const toggle = async () => {
    if (listeningRef.current) {
      stop();
      return;
    }

    setError(null);
    startedWithRef.current = value.trim();
    lockedRef.current = value.trim();
    transcriptRef.current = value.trim();
    interimRef.current = "";
    langIndexRef.current = 0;

    const canListen = Boolean(getSpeechRecognition());
    const canRecord =
      Boolean(navigator.mediaDevices) && typeof MediaRecorder !== "undefined";

    if (!canListen && !canRecord) {
      setSupported(false);
      setError("Voice-to-text is not supported in this browser.");
      return;
    }

    if (!canListen && !whisperReady) {
      setError("Voice-to-text is unavailable here — type the note instead.");
      return;
    }

    listeningRef.current = true;
    setListening(true);

    try {
      if (canListen) {
        if (!startBrowserRecognition()) {
          if (!listeningRef.current) return;
          throw new Error("start_failed");
        }
        return;
      }
      await startRecording();
    } catch (cause) {
      listeningRef.current = false;
      setListening(false);
      stopMic();
      if (cause instanceof DOMException && cause.name === "NotAllowedError") {
        setError("Microphone permission was denied.");
        return;
      }
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
          onClick={() => void toggle()}
          disabled={!supported || transcribing}
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
            lockedRef.current = event.target.value.trim();
            transcriptRef.current = event.target.value.trim();
            interimRef.current = "";
          }
          onChange(event.target.value);
        }}
        lang="en"
        className={`${desk.input} resize-none`}
      />
      <p className="mt-1.5 text-xs text-zinc-400">
        {listening
          ? "Listening…"
          : transcribing
            ? "Transcribing the last clip…"
            : supported
              ? "Type freely, or use voice-to-text."
              : "Voice-to-text is unavailable here — type the note instead."}
      </p>
      {error && <p className="mt-1 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
