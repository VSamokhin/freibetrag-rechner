import { defineConfig } from "vitest/config";
import { ROOT, versionOf } from "./scripts/version.mjs";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(versionOf(ROOT)) },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "scripts/version.mjs"],
      exclude: ["src/main.ts"],
      reporter: ["text", "html", "lcov", "json-summary"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
