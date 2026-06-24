import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin-auth";
import { getSourceHealthReport } from "@/lib/sources/health";
import { buildSourceRunFromHealthSnapshot } from "@/lib/sources/runHistoryBuilder";
import {
  appendSourceRun,
  getLatestSourceRun,
  getSourceRunHistoryLimit,
  listSourceRuns
} from "@/lib/sources/runHistoryStore";

function getRequestToken(request: NextRequest) {
  const url = new URL(request.url);
  return request.headers.get("x-admin-token") ?? url.searchParams.get("key");
}

function unauthorized() {
  return NextResponse.json({ error: "Admin access required" }, { status: 401 });
}

function parseLimit(value: string | null) {
  if (!value) {
    return getSourceRunHistoryLimit();
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function GET(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  if (limit === null) {
    return NextResponse.json({ error: "limit must be a positive integer" }, { status: 400 });
  }

  const providerId = url.searchParams.get("providerId")?.trim() || null;
  const runs = listSourceRuns();
  const filteredRuns = providerId
    ? runs.filter((run) => run.providers.some((provider) => provider.providerId === providerId))
    : runs;

  return NextResponse.json({
    ok: true,
    runs: filteredRuns.slice(0, limit),
    latest: filteredRuns[0] ?? null
  });
}

export async function POST(request: NextRequest) {
  if (!requireAdminToken(getRequestToken(request))) {
    return unauthorized();
  }

  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  const action = typeof body.action === "string" ? body.action.trim() : "health-snapshot";

  if (action !== "health-snapshot") {
    return NextResponse.json({ error: "action must be health-snapshot" }, { status: 400 });
  }

  const record = appendSourceRun(buildSourceRunFromHealthSnapshot(getSourceHealthReport()));
  return NextResponse.json({
    ok: true,
    run: record,
    latest: getLatestSourceRun()
  });
}
