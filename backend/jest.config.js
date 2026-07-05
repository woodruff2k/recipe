/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],

  // --- coverage ---
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/index.ts", // bootstrap (listen/shutdown) — 통합테스트 영역
    "!src/**/*.d.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov", "json-summary"],
  // 게이트가 필요하면 주석 해제(현재는 샘플 테스트만 있어 비활성):
  // coverageThreshold: {
  //   global: { statements: 70, branches: 60, functions: 70, lines: 70 },
  // },
};
