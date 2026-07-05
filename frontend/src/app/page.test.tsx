import { render, screen, waitFor } from "@testing-library/react";
import HomePage from "./page";
import { api } from "@/lib/api";

// API 클라이언트를 모킹 — 컴포넌트는 lib/api만 의존하므로 네트워크 없이 검증.
jest.mock("@/lib/api", () => ({
  api: { listRecipes: jest.fn() },
  ApiError: class ApiError extends Error {},
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe("HomePage", () => {
  it("shows loading then renders fetched recipes", async () => {
    mockedApi.listRecipes.mockResolvedValue({
      recipes: [
        {
          id: "1",
          title: "김치찌개",
          description: "맛있는 김치찌개",
          ingredients: [],
          steps: [],
          imageUrl: null,
          authorId: "u1",
          author: { id: "u1", name: "셰프" },
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ],
    });

    render(<HomePage />);

    expect(screen.getByText("불러오는 중...")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("김치찌개")).toBeInTheDocument());
  });
});
