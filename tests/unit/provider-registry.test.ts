import { describe, expect, it } from "vitest";
import { getAllProviders, getEnabledProviders } from "../../apps/web/lib/sources/registry";

describe("provider registry", () => {
  it("contains the mock provider and exposes enabled providers", () => {
    const allProviders = getAllProviders();
    const enabledProviders = getEnabledProviders();

    expect(allProviders.some((provider) => provider.sourceId === "mock")).toBe(true);
    expect(enabledProviders.some((provider) => provider.sourceId === "mock")).toBe(true);
  });
});
