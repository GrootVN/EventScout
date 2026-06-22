import { NextRequest, NextResponse } from "next/server";
import { deactivateTrustedSource, listTrustedSources, upsertTrustedSource } from "@/lib/event-service";
import { requireAdminToken } from "@/lib/admin-auth";
import type { EventSourceFamily, TrustedSource } from "@eventscout/shared";

function getRequestToken(request: NextRequest) {
  const url = new URL(request.url);
  return request.headers.get("x-admin-token") ?? url.searchParams.get("key");
}

function unauthorized() {
  return NextResponse.json({ error: "Admin access required" }, { status: 401 });
}

function isValidSourceType(value: unknown): value is TrustedSource["source_type"] {
  return value === "domain" || value === "account" || value === "profile_url";
}

function isValidSourceFamily(value: unknown): value is EventSourceFamily {
  return (
    value === "listing_api" ||
    value === "forum" ||
    value === "community" ||
    value === "ticketing" ||
    value === "venue" ||
    value === "calendar" ||
    value === "social" ||
    value === "news" ||
    value === "other"
  );
}

export async function GET(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  return NextResponse.json({
    data: await listTrustedSources()
  });
}

export async function POST(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const body = (await request.json()) as {
    source_type?: unknown;
    source_value?: unknown;
    source_family?: unknown;
    notes?: unknown;
    active?: unknown;
  };

  if (!isValidSourceType(body.source_type) || !isValidSourceFamily(body.source_family) || typeof body.source_value !== "string") {
    return NextResponse.json({ error: "source_type, source_value, and source_family are required" }, { status: 400 });
  }

  const source = await upsertTrustedSource({
    source_type: body.source_type,
    source_value: body.source_value,
    source_family: body.source_family,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    active: typeof body.active === "boolean" ? body.active : undefined
  });

  return NextResponse.json({
    data: source
  });
}

export async function DELETE(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  const idFromBody = typeof body.id === "string" ? body.id.trim() : "";
  const id = url.searchParams.get("id")?.trim() ?? idFromBody;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await deactivateTrustedSource(id);

  return NextResponse.json({ ok: true });
}
