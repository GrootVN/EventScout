import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web"),
      "@eventscout/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      "@eventscout/shared/": path.resolve(__dirname, "packages/shared/src/")
    }
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
