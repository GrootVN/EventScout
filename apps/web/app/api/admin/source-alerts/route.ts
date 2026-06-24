import { NextRequest, NextResponse } from "next/server";
import { requireAdminToken } from "@/lib/admin-auth";
import { getCurrentSourceAlerts } from "@/lib/sources/sourceAlerts";

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

  const result = getCurrentSourceAlerts();

  return NextResponse.json({
    ok: true,
    generatedAt: result.generatedAt,
    thresholds: result.thresholds,
    summary: result.summary,
    alerts: result.alerts
  });
}
