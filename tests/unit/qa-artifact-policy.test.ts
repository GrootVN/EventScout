import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("QA artifact policy", () => {
  it("ignores generated QA reports while keeping sample fixtures tracked", async () => {
    const gitignorePath = path.resolve(process.cwd(), ".gitignore");
    const gitignore = await readFile(gitignorePath, "utf8");

    expect(gitignore).toContain("qa-results/*.html");
    expect(gitignore).toContain("qa-results/*.json");
    expect(gitignore).not.toContain("docs/examples/aggregator-report.sample.json");
  });
});
