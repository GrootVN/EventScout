import { NextResponse } from "next/server";
import { getSourceHealthReport } from "@/lib/sources/health";

export async function GET() {
  const sourceHealth = getSourceHealthReport();
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    config: {
      has_database: Boolean(process.env.DATABASE_URL),
      has_redis: Boolean(process.env.REDIS_URL),
      launch_metro_city: process.env.LAUNCH_METRO_CITY ?? "Cincinnati",
      launch_metro_region: process.env.LAUNCH_METRO_REGION ?? "OH"
    },
    sourceHealth
  });
}
