import { test, expect } from "@playwright/test";

// 백엔드 없이도 통과(프론트 렌더만 검증). 전체 플로우 예시는 아래 주석 참고.
test("home page renders the brand", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /RecipeShare/ })).toBeVisible();
});

test("login page renders the form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("이메일")).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
});

// 전체 해피패스(백엔드 + DB 필요). 스택을 띄운 뒤 주석 해제해서 사용:
// test("register → 레시피 작성 → 상세", async ({ page }) => {
//   const email = `e2e+${Date.now()}@test.dev`;
//   await page.goto("/register");
//   await page.getByLabel("이름").fill("E2E");
//   await page.getByLabel("이메일").fill(email);
//   await page.getByLabel(/비밀번호/).fill("password123");
//   await page.getByRole("button", { name: "회원가입" }).click();
//   await expect(page).toHaveURL("/");
//   await page.getByRole("link", { name: "레시피 작성" }).click();
//   await page.getByLabel("제목").fill("E2E 김치찌개");
//   await page.getByLabel("설명").fill("자동화 테스트");
//   await page.getByRole("button", { name: "레시피 등록" }).click();
//   await expect(page.getByRole("heading", { name: "E2E 김치찌개" })).toBeVisible();
// });
