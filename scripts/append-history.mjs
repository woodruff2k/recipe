#!/usr/bin/env node
// metrics.json 레코드를 history.json 배열에 추가하고 최근 N개만 유지한다.
// 사용법: node scripts/append-history.mjs <history.json 경로> <metric.json 경로>

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const HISTORY_LIMIT = 50;

const historyPath = process.argv[2] ?? "public/data/history.json";
const metricPath = process.argv[3] ?? "metrics.json";

const metric = JSON.parse(readFileSync(metricPath, "utf-8"));

let history = [];
if (existsSync(historyPath)) {
  try {
    history = JSON.parse(readFileSync(historyPath, "utf-8"));
    if (!Array.isArray(history)) history = [];
  } catch {
    history = [];
  }
}

history.push(metric);
if (history.length > HISTORY_LIMIT) {
  history = history.slice(history.length - HISTORY_LIMIT);
}

mkdirSync(path.dirname(historyPath), { recursive: true });
writeFileSync(historyPath, JSON.stringify(history, null, 2));
console.log(`history.json now has ${history.length} entries (${historyPath})`);
