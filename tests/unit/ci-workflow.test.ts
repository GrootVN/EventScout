import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("CI workflow", () => {
  it("runs lint, typecheck, test, and build", () => {
    const workflowPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run typecheck");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
  });
});
