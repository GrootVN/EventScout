import { NextResponse } from "next/server";
import { listSourceSummaries } from "@/lib/events/service";

export async function GET() {
  return NextResponse.json({
    providers: await listSourceSummaries()
  });
}
