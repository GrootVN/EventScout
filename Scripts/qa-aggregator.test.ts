import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { writeAggregatorQaReport } from "../apps/web/lib/events/aggregatorQa";

describe("qa:aggregator", () => {
  it("generates HTML and JSON QA artifacts", async () => {
    const outputDir = path.resolve(process.cwd(), "qa-results");
    const result = await writeAggregatorQaReport(outputDir);

    await Promise.all([access(result.htmlPath), access(result.jsonPath)]);

    const reportJson = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
      finalCount: number;
      rawEventCount: number;
      events: unknown[];
      enabledProviders: Array<{ sourceName: string }>;
      duplicateGroups: Array<{ sourceNames: string[]; sourceUrls: string[] }>;
    };
    const reportHtml = await readFile(result.htmlPath, "utf8");

    expect(reportJson.enabledProviders.length).toBeGreaterThan(0);
    expect(reportJson.enabledProviders.some((provider) => provider.sourceName === "Mock Local Radar")).toBe(true);
    expect(reportJson.enabledProviders.some((provider) => provider.sourceName === "Community Calendar Mock")).toBe(true);
    expect(reportJson.rawEventCount).toBeGreaterThan(reportJson.finalCount);
    expect(reportJson.finalCount).toBe(reportJson.events.length);
    expect(reportJson.duplicateGroups.length).toBeGreaterThan(0);
    expect(reportJson.duplicateGroups.some((group) => group.sourceNames.length > 1)).toBe(true);
    expect(reportHtml).toContain("Aggregator QA Report");
    expect(reportHtml).toContain("Enabled Providers");
    expect(reportHtml).toContain("Community Calendar Mock");
    expect(reportHtml).toContain("https://");
  });
});
