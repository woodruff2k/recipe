import { defineConfig, devices } from "@playwright/test";

// E2E는 앱이 떠 있다고 가정한다:
//   docker compose -f docker-compose.dev.yml up        (권장: DB 포함 전체)
//   또는 pnpm dev (별도 Postgres 필요)
// 그런 다음: pnpm test:e2e
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // 앱을 자동 기동하려면 주석 해제(전체 스택이 필요):
  // webServer: {
  //   command: "docker compose -f docker-compose.dev.yml up",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 180_000,
  // },
});
