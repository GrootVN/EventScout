import { describe, expect, it } from "vitest";
import { validateCuratedEvent } from "../../apps/web/lib/events/curatedSchema";

describe("validateCuratedEvent", () => {
  it("accepts a valid curated event", () => {
    const result = validateCuratedEvent({
      id: "curated-valid-1",
      title: "Neighborhood Welcome Coffee",
      startDateTime: "2026-06-23T22:30:00.000Z",
      city: "Cincinnati",
      priceType: "free",
      sourceUrl: "https://example.com/curated/events/welcome-coffee",
      status: "approved",
      categories: ["community"],
      interests: ["newcomer-friendly"],
      isNewcomerFriendly: true,
      isSoloFriendly: true
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("approved");
      expect(result.value.sourceUrl).toBe("https://example.com/curated/events/welcome-coffee");
    }
  });

  it("defaults status to approved when omitted", () => {
    const result = validateCuratedEvent({
      id: "curated-default-status",
      title: "Board Game Brunch",
      startDateTime: "2026-06-25T15:00:00.000Z",
      city: "Cincinnati",
      priceType: "paid",
      sourceUrl: "https://example.com/curated/events/board-game-brunch"
    });

    expect(result).toMatchObject({
      ok: true
    });
    if (result.ok) {
      expect(result.value.status).toBe("approved");
    }
  });

  it("rejects missing title", () => {
    const result = validateCuratedEvent({
      id: "missing-title",
      startDateTime: "2026-06-23T22:30:00.000Z",
      city: "Cincinnati",
      priceType: "free",
      sourceUrl: "https://example.com/curated/events/missing-title"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("title is required");
    }
  });

  it("rejects missing startDateTime", () => {
    const result = validateCuratedEvent({
      id: "missing-start",
      title: "Missing Start",
      city: "Cincinnati",
      priceType: "free",
      sourceUrl: "https://example.com/curated/events/missing-start"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("startDateTime is required");
    }
  });

  it("rejects malformed startDateTime", () => {
    const result = validateCuratedEvent({
      id: "bad-start",
      title: "Bad Start",
      startDateTime: "not-a-date",
      city: "Cincinnati",
      priceType: "free",
      sourceUrl: "https://example.com/curated/events/bad-start"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("startDateTime must be a valid date string");
    }
  });

  it("rejects missing sourceUrl", () => {
    const result = validateCuratedEvent({
      id: "missing-url",
      title: "Missing URL",
      startDateTime: "2026-06-23T22:30:00.000Z",
      city: "Cincinnati",
      priceType: "free"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("sourceUrl is required");
    }
  });

  it("rejects invalid sourceUrl", () => {
    const result = validateCuratedEvent({
      id: "bad-url",
      title: "Bad URL",
      startDateTime: "2026-06-23T22:30:00.000Z",
      city: "Cincinnati",
      priceType: "free",
      sourceUrl: "notaurl"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("sourceUrl must be a valid URL");
    }
  });

  it("rejects unsupported status values", () => {
    const result = validateCuratedEvent({
      id: "bad-status",
      title: "Bad Status",
      startDateTime: "2026-06-23T22:30:00.000Z",
      city: "Cincinnati",
      priceType: "free",
      sourceUrl: "https://example.com/curated/events/bad-status",
      status: "draft" as never
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("status must be approved, pending, rejected, or suppressed");
    }
  });
});
