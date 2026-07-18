import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL(".", import.meta.url).pathname,
    },
  },
  test: {
    environment: "edge-runtime",
    exclude: ["**/node_modules/**", "**/.git/**", "tests/e2e/**"],
    env: {
      RECIPE_ADMIN_PASSWORD: "test-password",
    },
  },
});
