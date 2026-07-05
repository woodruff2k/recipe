import { test } from "@playwright/test";
import percySnapshot from "@percy/playwright";

// 시각 회귀 테스트(Percy). 테스트 제목의 "@visual" 태그로 일반 E2E와 구분한다.
//   일반 E2E:  playwright test --grep-invert "@visual"
//   시각 회귀:  percy exec -- playwright test --grep "@visual"
// PERCY_TOKEN 없이 로컬에서 돌리면 percySnapshot은 경고만 남기고 그냥 지나간다
// (에러 아님) — https://docs.percy.io

const API = process.env.E2E_API_URL ?? "http://localhost:4000";

test.describe("visual regression @visual", () => {
  test("홈 페이지 @visual", async ({ page }) => {
    await page.goto("/");
    await percySnapshot(page, "홈 - 레시피 목록");
  });

  test("로그인 페이지 @visual", async ({ page }) => {
    await page.goto("/login");
    await percySnapshot(page, "로그인");
  });

  test("회원가입 페이지 @visual", async ({ page }) => {
    await page.goto("/register");
    await percySnapshot(page, "회원가입");
  });

  test("로그인 사용자 화면들 @visual", async ({ page, request }) => {
    const stamp = Date.now();

    // API로 계정/데이터 시드(빠르고 결정적), SPA 인증은 토큰 주입으로 처리.
    const reg = await request.post(`${API}/api/auth/register`, {
      data: {
        email: `visual+${stamp}@test.dev`,
        password: "password123",
        name: "Visual Tester",
      },
    });
    const { token } = await reg.json();

    const recipe = await request.post(`${API}/api/recipes`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `시각회귀 테스트 레시피 ${stamp}`,
        description: "Percy 스냅샷용 고정 데이터",
        ingredients: ["재료1", "재료2"],
        steps: ["1단계", "2단계"],
      },
    });
    const { recipe: created } = await recipe.json();

    await page.addInitScript((t) => localStorage.setItem("recipe.token", t), token);

    await page.goto("/");
    await percySnapshot(page, "홈 - 로그인 상태");

    await page.goto("/recipes/new");
    await percySnapshot(page, "레시피 작성");

    await page.goto(`/recipes/${created.id}`);
    await percySnapshot(page, "레시피 상세");

    await page.goto(`/recipes/${created.id}/edit`);
    await percySnapshot(page, "레시피 수정");

    await page.goto("/mypage");
    await percySnapshot(page, "마이페이지");

    await page.goto("/profile");
    await percySnapshot(page, "프로필");
  });
});
