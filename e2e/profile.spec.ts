import { test, expect } from "@playwright/test";

// 프로필 조회/수정(US-1.6). 전체 스택(docker-compose.dev.yml) 대상.
test("프로필: 조회 → 이름/이메일 수정 → 헤더/새로고침에 반영", async ({ page }) => {
  const stamp = Date.now();
  const email = `profile+${stamp}@test.dev`;
  const updatedEmail = `profile+${stamp}+updated@test.dev`;

  // 1) 회원가입 → 자동 로그인
  await page.goto("/register");
  await page.getByLabel("이름").fill("Profile Tester");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel(/비밀번호/).fill("password123");
  await page.getByRole("button", { name: "회원가입" }).click();
  await expect(page).toHaveURL("/");

  // 2) 헤더의 이름 링크로 프로필 진입 → 기존 값이 채워져 있는지 확인
  await page.getByRole("link", { name: "Profile Tester" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByLabel("이름")).toHaveValue("Profile Tester");
  await expect(page.getByLabel("이메일")).toHaveValue(email);

  // 3) 이름/이메일 수정 → 저장
  await page.getByLabel("이름").fill("Profile Tester (수정)");
  await page.getByLabel("이메일").fill(updatedEmail);
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("프로필이 수정되었습니다.")).toBeVisible();

  // 4) 헤더에 즉시 반영
  await expect(page.getByRole("link", { name: "Profile Tester (수정)" })).toBeVisible();

  // 5) 새로고침 후에도 변경된 값이 유지되는지(서버에 실제로 저장됐는지) 확인
  await page.reload();
  await expect(page.getByLabel("이름")).toHaveValue("Profile Tester (수정)");
  await expect(page.getByLabel("이메일")).toHaveValue(updatedEmail);
});

test("프로필: 로그인하지 않으면 로그인 페이지로 리다이렉트", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
});
