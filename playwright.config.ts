import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  use: {
    headless: true,
    channel: "chrome",
    launchOptions: { args: ["--use-fake-device-for-media-stream"] },
  },
  workers: 1,
  reporter: "list",
  webServer: {
    command: "npm run dev",
    url: process.env.SEHAT_QA_URL || "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
