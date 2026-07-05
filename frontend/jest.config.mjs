import nextJest from "next/jest.js";

// next/jest: SWC 변환·CSS/이미지 모킹·tsconfig paths(@/*)·.env 로딩을 자동 처리.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",

  // tsconfig의 "@/*" 경로 별칭을 jest에 매핑
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // --- coverage ---
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/layout.tsx", // 루트 레이아웃(폰트/Provider) — 컴포넌트 테스트 대상 아님
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "lcov"],
  // coverageThreshold: { global: { statements: 60, branches: 50, functions: 60, lines: 60 } },
};

export default createJestConfig(config);
