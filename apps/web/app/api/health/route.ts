import { NextResponse } from "next/server";
import { canViewDetailedHealth, getPublicHealthSummary, getSourceHealthReport } from "@/lib/sources/health";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authToken = request.headers.get("x-admin-token") ?? url.searchParams.get("key");
  const detailed = canViewDetailedHealth(authToken);
  const summary = getPublicHealthSummary();
  const health = detailed ? getSourceHealthReport() : summary;

  return NextResponse.json({
    status: detailed ? "ok" : summary.status,
    timestamp: new Date().toISOString(),
    mode: detailed ? "detailed" : "summary",
    health: detailed
      ? health
      : {
          ...health
        }
  });
}
