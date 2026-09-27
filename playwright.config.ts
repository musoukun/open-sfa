import { defineConfig } from "@playwright/test";

process.loadEnvFile(".env");

export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3100",
    // インストール済みの Google Chrome を使い、ブラウザのダウンロードを避ける
    channel: "chrome",
    locale: "ja-JP",
    screenshot: "only-on-failure",
  },
});
