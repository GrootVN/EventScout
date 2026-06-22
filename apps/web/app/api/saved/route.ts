import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    storage: "local-browser-storage",
    key: "event-scout-saved-events"
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((value): value is string => typeof value === "string") : [];
  return NextResponse.json({ data: ids });
}
