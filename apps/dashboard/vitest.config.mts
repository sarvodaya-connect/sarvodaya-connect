import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolves the `@/` and `@sarvodaya-connect/api-contracts` aliases from tsconfig.json.
    tsconfigPaths: true,
    // Next.js provides this marker when it builds; it has no package to resolve in tests.
    alias: { "server-only": new URL("./vitest.server-only.ts", import.meta.url).pathname },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
