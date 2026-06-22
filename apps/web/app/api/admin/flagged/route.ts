import { NextRequest, NextResponse } from "next/server";
import { getFlaggedEvents, suppressEvent } from "@/lib/event-service";
import { requireAdminToken } from "@/lib/admin-auth";

function getRequestToken(request: NextRequest) {
  const url = new URL(request.url);
  return request.headers.get("x-admin-token") ?? url.searchParams.get("key");
}

function unauthorized() {
  return NextResponse.json({ error: "Admin access required" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  return NextResponse.json({
    data: await getFlaggedEvents()
  });
}

export async function POST(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const body = (await request.json()) as { event_id?: unknown; note?: unknown };
  const eventId = typeof body.event_id === "string" ? body.event_id.trim() : "";

  if (!eventId) {
    return NextResponse.json({ error: "event_id is required" }, { status: 400 });
  }

  await suppressEvent(eventId, typeof body.note === "string" ? body.note : undefined);

  return NextResponse.json({ ok: true });
}
