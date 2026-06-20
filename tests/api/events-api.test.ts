import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getEvents } from "../../apps/web/app/api/events/route";

afterEach(() => {
  vi.resetModules();
});

describe("GET /api/events", () => {
  it("returns a response payload with data", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/events?city=Cincinnati&datePreset=this-weekend&interests=tech&soloFriendly=true"
    );
    const response = await getEvents(request);
    const payload = (await response.json()) as { data?: unknown[] };
    expect(response.status).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
  });

  it("preserves original source attribution in the payload", async () => {
    const request = new NextRequest("http://localhost:3000/api/events?city=Cincinnati&datePreset=this-month");
    const response = await getEvents(request);
    const payload = (await response.json()) as {
      data?: Array<{ originalSources?: Array<{ sourceName: string; sourceUrl: string }> }>;
    };

    expect(response.status).toBe(200);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data?.[0]?.originalSources?.[0]?.sourceName).toBeTruthy();
    expect(payload.data?.[0]?.originalSources?.[0]?.sourceUrl).toContain("https://");
  });
});
