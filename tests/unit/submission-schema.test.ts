import { describe, expect, it } from "vitest";
import { validateCommunitySubmissionInput } from "../../apps/web/lib/submissions/submissionSchema";

describe("validateCommunitySubmissionInput", () => {
  it("accepts a valid submission", () => {
    const result = validateCommunitySubmissionInput({
      title: " Neighborhood Welcome Coffee ",
      description: " A low-pressure hello for new neighbors. ",
      startDateTime: "2026-06-24T22:30:00.000Z",
      endDateTime: "2026-06-24T23:30:00.000Z",
      timezone: " America/New_York ",
      venueName: " Central Library ",
      address: " 800 Vine St, Cincinnati, OH 45202 ",
      city: " Cincinnati ",
      region: " OH ",
      country: " USA ",
      priceType: "free",
      minPrice: 0,
      maxPrice: 0,
      currency: " USD ",
      sourceUrl: " https://example.com/events/welcome-coffee ",
      categories: [" community ", "social"],
      interests: " newcomer-friendly, solo-friendly ",
      submitterName: " Maya ",
      submitterEmail: " maya@example.com ",
      submitterNote: " Happy to help. "
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Neighborhood Welcome Coffee");
      expect(result.value.sourceUrl).toBe("https://example.com/events/welcome-coffee");
      expect(result.value.categories).toEqual(["community", "social"]);
      expect(result.value.interests).toEqual(["newcomer-friendly", "solo-friendly"]);
      expect(result.value.priceType).toBe("free");
    }
  });

  it("rejects missing title", () => {
    const result = validateCommunitySubmissionInput({
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/welcome-coffee"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: "title" })]));
    }
  });

  it("rejects missing and invalid start dates", () => {
    const missing = validateCommunitySubmissionInput({
      title: "Missing date",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/missing-date"
    });
    const invalid = validateCommunitySubmissionInput({
      title: "Bad date",
      startDateTime: "not-a-date",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/bad-date"
    });

    expect(missing.ok).toBe(false);
    expect(invalid.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.issues.some((issue) => issue.path === "startDateTime")).toBe(true);
    }
    if (!invalid.ok) {
      expect(invalid.issues.some((issue) => issue.path === "startDateTime")).toBe(true);
    }
  });

  it("rejects missing city, missing sourceUrl, invalid sourceUrl, and invalid email", () => {
    const missingCity = validateCommunitySubmissionInput({
      title: "Missing city",
      startDateTime: "2026-06-24T22:30:00.000Z",
      sourceUrl: "https://example.com/events/missing-city"
    });
    const missingUrl = validateCommunitySubmissionInput({
      title: "Missing url",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati"
    });
    const invalidUrl = validateCommunitySubmissionInput({
      title: "Bad url",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "notaurl"
    });
    const invalidEmail = validateCommunitySubmissionInput({
      title: "Bad email",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/bad-email",
      submitterEmail: "not-an-email"
    });

    expect(missingCity.ok).toBe(false);
    expect(missingUrl.ok).toBe(false);
    expect(invalidUrl.ok).toBe(false);
    expect(invalidEmail.ok).toBe(false);
    if (!invalidEmail.ok) {
      expect(invalidEmail.issues.some((issue) => issue.path === "submitterEmail")).toBe(true);
    }
  });

  it("defaults priceType to unknown when omitted", () => {
    const result = validateCommunitySubmissionInput({
      title: "Default price",
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/default-price"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.priceType).toBe("unknown");
      expect(result.value.categories).toEqual([]);
      expect(result.value.interests).toEqual([]);
    }
  });

  it("truncates overly long text fields safely", () => {
    const result = validateCommunitySubmissionInput({
      title: "x".repeat(200),
      description: "y".repeat(3200),
      venueName: "z".repeat(200),
      address: "a".repeat(400),
      submitterName: "b".repeat(200),
      submitterEmail: "long@example.com",
      submitterNote: "d".repeat(2400),
      startDateTime: "2026-06-24T22:30:00.000Z",
      city: "Cincinnati",
      sourceUrl: "https://example.com/events/long-fields"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title.length).toBeLessThanOrEqual(160);
      expect(result.value.description?.length ?? 0).toBeLessThanOrEqual(3000);
      expect(result.value.venueName?.length ?? 0).toBeLessThanOrEqual(160);
      expect(result.value.address?.length ?? 0).toBeLessThanOrEqual(300);
      expect(result.value.submitterName?.length ?? 0).toBeLessThanOrEqual(120);
      expect(result.value.submitterNote?.length ?? 0).toBeLessThanOrEqual(2000);
    }
  });
});
