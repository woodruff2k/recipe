#!/usr/bin/env node
// 마크다운 파일 하나를 테스트 대시보드와 톤을 맞춘 다크 테마 HTML로 렌더링한다.
// 사용법: node scripts/render-markdown.mjs <input.md> <output.html> <title>

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { marked } from "marked";

const [, , inputPath, outputPath, title] = process.argv;

if (!inputPath || !outputPath) {
  console.error(
    "사용법: node scripts/render-markdown.mjs <input.md> <output.html> [title]",
  );
  process.exit(1);
}

const markdown = readFileSync(inputPath, "utf-8");
const body = marked.parse(markdown);

const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title ?? "RecipeShare Docs"}</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        padding: 32px 24px 64px;
        background: #0b0f19;
        color: #e5e7eb;
      }
      main {
        max-width: 820px;
        margin: 0 auto;
      }
      a { color: #60a5fa; }
      h1, h2, h3 { color: #f3f4f6; }
      h1 { border-bottom: 1px solid #1f2937; padding-bottom: 12px; }
      code {
        background: #131826;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.9em;
      }
      pre {
        background: #131826;
        border: 1px solid #1f2937;
        border-radius: 8px;
        padding: 16px;
        overflow-x: auto;
      }
      pre code { background: none; padding: 0; }
      table { border-collapse: collapse; width: 100%; margin: 16px 0; }
      th, td { border: 1px solid #1f2937; padding: 8px 12px; text-align: left; }
      blockquote {
        border-left: 3px solid #3b82f6;
        margin: 16px 0;
        padding: 4px 16px;
        color: #9ca3af;
      }
      .back-link { display: inline-block; margin-bottom: 24px; font-size: 0.9rem; }
    </style>
  </head>
  <body>
    <main>
      <a class="back-link" href="./index.html">&larr; 문서 허브로</a>
      ${body}
    </main>
  </body>
</html>
`;

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html);
console.log(`rendered ${inputPath} -> ${outputPath}`);
