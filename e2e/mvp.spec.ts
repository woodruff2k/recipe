import { test, expect } from "@playwright/test";

// 전체 스택(docker-compose.dev.yml) 대상 MVP 해피패스 + 인증 가드.
test("MVP: 회원가입 → 작성 → 검색 → 수정 → 삭제 → 가드", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e+${stamp}@test.dev`;
  const title = `E2E 김치찌개 ${stamp}`;
  const updatedTitle = `${title} (수정)`;

  // 삭제 시 window.confirm 자동 수락
  page.on("dialog", (d) => d.accept());

  // 1) 회원가입 → 자동 로그인 → 홈
  await page.goto("/register");
  await page.getByLabel("이름").fill("E2E Tester");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel(/비밀번호/).fill("password123");
  await page.getByRole("button", { name: "회원가입" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("E2E Tester")).toBeVisible();

  // 2) 레시피 작성 → 상세
  await page.getByRole("link", { name: "레시피 작성" }).click();
  await expect(page).toHaveURL(/\/recipes\/new$/);
  await page.getByLabel("제목").fill(title);
  await page.getByLabel("설명").fill("자동화 테스트 레시피");
  await page.getByLabel("재료 (한 줄에 하나씩)").fill("김치\n돼지고기");
  await page.getByLabel("조리 순서 (한 줄에 하나씩)").fill("끓인다\n먹는다");
  await page.getByRole("button", { name: "레시피 등록" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // 3) 홈 목록 + 검색
  await page.getByRole("link", { name: /RecipeShare/ }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(title)).toBeVisible();

  await page.getByLabel("레시피 검색").fill("김치찌개");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByText(title)).toBeVisible();

  await page.getByLabel("레시피 검색").fill("존재하지않는검색어zzz");
  await page.getByRole("button", { name: "검색" }).click();
  await expect(page.getByText("결과가 없습니다.")).toBeVisible();

  // 4) 수정
  await page.goto("/");
  await page.getByText(title).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("link", { name: "수정" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  await page.getByLabel("제목").fill(updatedTitle);
  await page.getByRole("button", { name: "수정 완료" }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();

  // 5) 삭제 → 목록에서 사라짐
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(updatedTitle)).toHaveCount(0);

  // 6) 인증 가드: 로그아웃 후 작성 페이지 접근 → 로그인으로 리다이렉트
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.goto("/recipes/new");
  await expect(page).toHaveURL(/\/login$/);
});
