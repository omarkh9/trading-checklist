import { NextResponse } from "next/server";
import { logAuth } from "@/lib/auth-log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event?: unknown;
      details?: unknown;
    };
    const event = typeof body.event === "string" ? body.event : "unknown";
    const details =
      body.details && typeof body.details === "object" ? body.details : {};
    logAuth(event, details as Record<string, unknown>);
  } catch (error) {
    logAuth("event_parse_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return new NextResponse(null, { status: 204 });
}
