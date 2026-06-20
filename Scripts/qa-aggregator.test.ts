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
      events: unknown[];
      enabledProviders: unknown[];
    };
    const reportHtml = await readFile(result.htmlPath, "utf8");

    expect(reportJson.enabledProviders.length).toBeGreaterThan(0);
    expect(reportJson.finalCount).toBe(reportJson.events.length);
    expect(reportHtml).toContain("Aggregator QA Report");
    expect(reportHtml).toContain("Enabled Providers");
  });
});
