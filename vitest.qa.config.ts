import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
      "@eventscout/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@eventscout/shared/": path.resolve(__dirname, "packages/shared/src/")
    }
  },
  test: {
    include: ["Scripts/qa-aggregator.test.ts"],
    environment: "node"
  }
});
