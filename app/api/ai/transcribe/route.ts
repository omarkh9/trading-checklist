import { getTranscribeConfig, VOICE_TRANSCRIBE_PROMPT } from "@/lib/ai/transcribe";
import { getAuthUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/m4a",
  "audio/mpga",
];

function fileNameFor(type: string) {
  if (type.includes("mp4") || type.includes("m4a")) return "note.m4a";
  if (type.includes("ogg")) return "note.ogg";
  if (type.includes("wav")) return "note.wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "note.mp3";
  return "note.webm";
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return Response.json({
    ok: true,
    enabled: getTranscribeConfig().enabled,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const config = getTranscribeConfig();
  if (!config.enabled) {
    return Response.json(
      { ok: false, error: "transcribe_unavailable", fallback: true },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 200) {
    return Response.json({ ok: false, error: "empty_audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }

  const type = (file.type || "audio/webm").split(";")[0];
  if (
    type &&
    type !== "application/octet-stream" &&
    !ALLOWED_TYPES.some((allowed) => type.startsWith(allowed))
  ) {
    return Response.json({ ok: false, error: "unsupported_type" }, { status: 415 });
  }

  const payload = new FormData();
  payload.append("file", file, file.name || fileNameFor(type));
  payload.append("model", config.model);
  payload.append("prompt", VOICE_TRANSCRIBE_PROMPT);

  try {
    const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: payload,
      signal: request.signal,
    });
    const data = (await response.json()) as { text?: string; error?: { message?: string } };
    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          error: data.error?.message || "transcription_failed",
        },
        { status: 502 }
      );
    }
    return Response.json({
      ok: true,
      text: String(data.text ?? "").trim(),
    });
  } catch {
    return Response.json(
      { ok: false, error: "transcription_failed" },
      { status: 502 }
    );
  }
}
