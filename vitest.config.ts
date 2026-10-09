import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@inzpo/shared": path.resolve(__dirname, "packages/shared/src"),
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "tests/shims/server-only.ts"),
    },
  },
});
