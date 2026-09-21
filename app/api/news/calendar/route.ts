import { NextResponse } from "next/server";
import { fetchForexFactoryCalendar } from "@/lib/news/calendar";

export const revalidate = 300;

export async function GET() {
  try {
    const events = await fetchForexFactoryCalendar();
    return NextResponse.json(
      { ok: true, events },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load the calendar.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
