import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    env: {
      RECIPE_ADMIN_PASSWORD: "test-password",
    },
  },
});
