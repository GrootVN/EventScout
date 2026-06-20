import { NextRequest, NextResponse } from "next/server";
import { parseSearchState } from "@/lib/events/query";
import { scoutEvents } from "@/lib/events/service";

function searchParamsToRecord(searchParams: URLSearchParams) {
  return {
    city: searchParams.get("city") ?? undefined,
    interests: searchParams.getAll("interests").length
      ? searchParams.getAll("interests")
      : (searchParams.get("interests") ?? undefined),
    datePreset: searchParams.get("datePreset") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    priceType: searchParams.get("priceType") ?? undefined,
    keyword: searchParams.get("keyword") ?? undefined,
    soloFriendly: searchParams.get("soloFriendly") ?? undefined,
    newcomerFriendly: searchParams.get("newcomerFriendly") ?? undefined
  };
}

export async function GET(request: NextRequest) {
  const state = parseSearchState(searchParamsToRecord(request.nextUrl.searchParams));
  const events = await scoutEvents(state, state);

  return NextResponse.json({
    data: events,
    meta: {
      count: events.length,
      generatedAt: new Date().toISOString()
    }
  });
}
