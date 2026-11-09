import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 15000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5194",
    headless: true,
    viewport: { width: 1800, height: 1200 },
    channel: process.platform === "win32" ? "msedge" : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 5194 --strictPort",
    url: "http://127.0.0.1:5194",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
