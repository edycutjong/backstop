import { defineConfig } from "vitest/config";

// Unit runner for the PURE, deterministic helpers in lib/ only.
// React rendering is covered by Playwright e2e; RPC hooks are out of scope.
export default defineConfig({
  test: {
    // These helpers are pure TS — no DOM needed.
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Scope coverage to exactly the three files under test.
      include: ["lib/format.ts", "lib/config.ts", "lib/cn.ts"],
    },
  },
});
