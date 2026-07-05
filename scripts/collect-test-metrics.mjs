#!/usr/bin/env node
// CI(main push)에서 테스트 실행 후 결과 JSON들을 모아 대시보드용 단일
// 메트릭 레코드(metrics.json)로 합친다.
//
// 입력(레포 루트 기준):
//   backend-results.json, frontend-results.json  — jest --json --outputFile
//   e2e-results.json                              — playwright --reporter=json
//   backend/coverage/coverage-summary.json         — jest coverageReporters: json-summary
//   frontend/coverage/coverage-summary.json
//
// 출력: metrics.json

import { readFileSync, writeFileSync, existsSync } from "fs";

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function summarizeJest(resultsPath, coveragePath) {
  const results = readJson(resultsPath);
  if (!results) return null;

  const coverage = readJson(coveragePath);
  const failedTests = [];
  for (const suite of results.testResults ?? []) {
    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status === "failed") {
        failedTests.push(assertion.fullName || assertion.title);
      }
    }
  }

  const durationMs = (results.testResults ?? []).reduce(
    (sum, s) => sum + Math.max(0, (s.endTime ?? 0) - (s.startTime ?? 0)),
    0,
  );

  return {
    total: results.numTotalTests ?? 0,
    passed: results.numPassedTests ?? 0,
    failed: results.numFailedTests ?? 0,
    durationMs,
    failedTests,
    coverage: coverage?.total
      ? {
          statements: coverage.total.statements.pct,
          branches: coverage.total.branches.pct,
          functions: coverage.total.functions.pct,
          lines: coverage.total.lines.pct,
        }
      : null,
  };
}

function summarizePlaywright(resultsPath) {
  const results = readJson(resultsPath);
  if (!results) return null;

  const failedTests = [];
  function walk(suites, prefix = "") {
    for (const suite of suites ?? []) {
      const title = prefix ? `${prefix} > ${suite.title}` : suite.title;
      for (const spec of suite.specs ?? []) {
        const ok = (spec.tests ?? []).every((t) =>
          (t.results ?? []).every((r) => r.status === "passed" || r.status === "skipped"),
        );
        if (!ok) failedTests.push(`${title} > ${spec.title}`);
      }
      walk(suite.suites, title);
    }
  }
  walk(results.suites);

  const stats = results.stats ?? {};
  const passed = stats.expected ?? 0;
  const failed = (stats.unexpected ?? 0) + (stats.flaky ?? 0);

  return {
    total: passed + failed + (stats.skipped ?? 0),
    passed,
    failed,
    durationMs: stats.duration ?? 0,
    failedTests,
  };
}

const backend = summarizeJest(
  "backend-results.json",
  "backend/coverage/coverage-summary.json",
);
const frontend = summarizeJest(
  "frontend-results.json",
  "frontend/coverage/coverage-summary.json",
);
const e2e = summarizePlaywright("e2e-results.json");

const suites = { backend, frontend, e2e };

const allFailed = [];
for (const [name, s] of Object.entries(suites)) {
  if (!s) continue;
  for (const t of s.failedTests) allFailed.push({ suite: name, name: t });
}

const totals = Object.values(suites)
  .filter(Boolean)
  .reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      passed: acc.passed + s.passed,
      failed: acc.failed + s.failed,
      durationMs: acc.durationMs + s.durationMs,
    }),
    { total: 0, passed: 0, failed: 0, durationMs: 0 },
  );

const metric = {
  sha: process.env.GITHUB_SHA ?? "local",
  ref: process.env.GITHUB_REF_NAME ?? "local",
  date: new Date().toISOString(),
  passRate:
    totals.total > 0 ? Number(((totals.passed / totals.total) * 100).toFixed(2)) : null,
  totals,
  suites: {
    backend: backend && {
      total: backend.total,
      passed: backend.passed,
      failed: backend.failed,
      durationMs: backend.durationMs,
      coverage: backend.coverage,
    },
    frontend: frontend && {
      total: frontend.total,
      passed: frontend.passed,
      failed: frontend.failed,
      durationMs: frontend.durationMs,
      coverage: frontend.coverage,
    },
    e2e: e2e && {
      total: e2e.total,
      passed: e2e.passed,
      failed: e2e.failed,
      durationMs: e2e.durationMs,
    },
  },
  failedTests: allFailed,
};

writeFileSync("metrics.json", JSON.stringify(metric, null, 2));
console.log(JSON.stringify(metric, null, 2));
