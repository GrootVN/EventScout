import { NextResponse } from "next/server";
import { canViewDetailedHealth, getPublicHealthSummary, getSourceHealthReport } from "@/lib/sources/health";
import { getPublicSourceRunHistorySummary } from "@/lib/sources/runHistoryStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authToken = request.headers.get("x-admin-token") ?? url.searchParams.get("key");
  const detailed = canViewDetailedHealth(authToken);
  const summary = getPublicHealthSummary();
  const history = getPublicSourceRunHistorySummary();
  const health = detailed ? getSourceHealthReport() : summary;

  return NextResponse.json({
    status: detailed ? "ok" : summary.status,
    timestamp: new Date().toISOString(),
    mode: detailed ? "detailed" : "summary",
    history,
    health: detailed
      ? health
      : {
          ...health
        }
  });
}
