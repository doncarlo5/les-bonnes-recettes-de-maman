import { defineConfig, devices } from "@playwright/test";

const viewports = [
  ["mobile-360", 360, 800],
  ["mobile-390", 390, 844],
  ["mobile-430", 430, 932],
  ["tablet-768", 768, 900],
  ["desktop", 1280, 900],
] as const;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    colorScheme: "light",
  },
  projects: viewports.map(([name, width, height]) => ({
    name,
    use: { ...devices["Desktop Chrome"], viewport: { width, height } },
  })),
  webServer: {
    command: "RECIPE_ADMIN_E2E=1 npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/fr/admin/recettes",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
