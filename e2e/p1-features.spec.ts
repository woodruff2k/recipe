import { test, expect } from "@playwright/test";

const API = process.env.E2E_API_URL ?? "http://localhost:4000";

// 페이지네이션(US-3.4) + 마이페이지(US-2.4). 데이터는 API로 시드(빠르고 결정적),
// SPA 인증은 토큰 주입으로 처리.
test("페이지네이션 + 마이페이지", async ({ page, request }) => {
  const stamp = Date.now();

  const reg = await request.post(`${API}/api/auth/register`, {
    data: { email: `p1+${stamp}@test.dev`, password: "password123", name: "P1 Tester" },
  });
  expect(reg.ok()).toBeTruthy();
  const { token } = await reg.json();

  // pageSize=6 → 7개면 2페이지
  for (let i = 1; i <= 7; i++) {
    const r = await request.post(`${API}/api/recipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `P1 레시피 ${stamp}-${i}`,
        description: `설명 ${i}`,
        ingredients: [],
        steps: [],
      },
    });
    expect(r.ok()).toBeTruthy();
  }

  // SPA를 인증 상태로
  await page.addInitScript((t) => localStorage.setItem("recipe.token", t), token);

  // --- 페이지네이션 ---
  await page.goto("/");
  await expect(page.getByText("페이지 1 / 2")).toBeVisible();
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("페이지 2 / 2")).toBeVisible();
  // 가장 먼저 만든 -1 은 최신순 정렬에서 마지막 페이지에 위치
  await expect(page.getByText(`P1 레시피 ${stamp}-1`)).toBeVisible();

  // --- 마이페이지 ---
  await page.getByRole("link", { name: "내 레시피" }).click();
  await expect(page).toHaveURL(/\/mypage$/);
  await expect(page.getByText(`P1 레시피 ${stamp}-7`)).toBeVisible();
  await expect(page.getByText(`P1 레시피 ${stamp}-1`)).toBeVisible();
});
