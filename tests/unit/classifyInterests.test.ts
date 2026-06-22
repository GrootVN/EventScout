import { describe, expect, it } from "vitest";
import { classifyInterests } from "../../apps/web/lib/events/classifyInterests";

describe("classifyInterests", () => {
  it("adds newcomer and solo tags for beginner social events", () => {
    const interests = classifyInterests({
      title: "Beginner Salsa Social",
      description: "No partner needed and very welcoming.",
      categories: ["culture", "nightlife"],
      priceType: "free"
    });

    expect(interests).toContain("newcomer-friendly");
    expect(interests).toContain("solo-friendly");
    expect(interests).toContain("free");
  });
});
