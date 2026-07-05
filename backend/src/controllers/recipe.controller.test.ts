import request from "supertest";
import { createApp } from "../app";
import { signToken } from "../utils/jwt";
import { prisma } from "../lib/prisma";

jest.mock("../lib/prisma", () => ({
  prisma: {
    recipe: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const mockedRecipe = prisma.recipe as unknown as {
  count: jest.Mock;
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "recipe-1",
    title: "토마토 파스타",
    description: "간단한 저녁 메뉴",
    ingredients: JSON.stringify(["파스타", "토마토소스"]),
    steps: JSON.stringify(["면을 삶는다", "소스에 버무린다"]),
    imageUrl: null,
    authorId: "user-1",
    author: { id: "user-1", name: "Chef" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("recipe.controller", () => {
  const app = createApp();
  const token = signToken({ sub: "user-1", email: "author@example.com" });
  const otherToken = signToken({ sub: "user-2", email: "other@example.com" });

  beforeEach(() => {
    mockedRecipe.count.mockReset();
    mockedRecipe.findMany.mockReset();
    mockedRecipe.findUnique.mockReset();
    mockedRecipe.create.mockReset();
    mockedRecipe.update.mockReset();
    mockedRecipe.delete.mockReset();
  });

  describe("GET /api/recipes", () => {
    it("기본 목록을 페이지네이션 정보와 함께 반환한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(1);
      mockedRecipe.findMany.mockResolvedValueOnce([makeRow()]);

      const res = await request(app).get("/api/recipes");

      expect(res.status).toBe(200);
      expect(res.body.recipes).toHaveLength(1);
      expect(res.body.recipes[0].ingredients).toEqual(["파스타", "토마토소스"]);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(6);
      expect(res.body.totalPages).toBe(1);
    });

    it("q가 있으면 제목/설명 OR 조건으로 검색한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(0);
      mockedRecipe.findMany.mockResolvedValueOnce([]);

      await request(app).get("/api/recipes").query({ q: "파스타" });

      const whereArg = mockedRecipe.findMany.mock.calls[0][0].where;
      expect(whereArg.OR).toEqual([
        { title: { contains: "파스타", mode: "insensitive" } },
        { description: { contains: "파스타", mode: "insensitive" } },
      ]);
    });

    it("q가 없으면 빈 where 조건으로 조회한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(0);
      mockedRecipe.findMany.mockResolvedValueOnce([]);

      await request(app).get("/api/recipes");

      expect(mockedRecipe.findMany.mock.calls[0][0].where).toEqual({});
    });

    it("page/pageSize 쿼리로 skip/take를 계산한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(20);
      mockedRecipe.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/recipes")
        .query({ page: "2", pageSize: "5" });

      expect(mockedRecipe.findMany.mock.calls[0][0].skip).toBe(5);
      expect(mockedRecipe.findMany.mock.calls[0][0].take).toBe(5);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(5);
      expect(res.body.totalPages).toBe(4);
    });

    it("pageSize가 50을 초과하면 50으로 clamp된다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(0);
      mockedRecipe.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get("/api/recipes").query({ pageSize: "999" });

      expect(res.body.pageSize).toBe(50);
    });

    it("page가 숫자가 아니면 1로 취급한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(0);
      mockedRecipe.findMany.mockResolvedValueOnce([]);

      const res = await request(app).get("/api/recipes").query({ page: "not-a-number" });

      expect(res.body.page).toBe(1);
    });

    it("pageSize가 숫자가 아니면 기본값(6)을 사용한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(0);
      mockedRecipe.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/recipes")
        .query({ pageSize: "not-a-number" });

      expect(res.body.pageSize).toBe(6);
    });

    it("author 관계가 없으면(null) 응답에서 undefined로 내려간다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(1);
      mockedRecipe.findMany.mockResolvedValueOnce([makeRow({ author: null })]);

      const res = await request(app).get("/api/recipes");

      expect(res.body.recipes[0].author).toBeUndefined();
    });

    it("ingredients가 배열이 아닌 유효한 JSON이면 빈 배열로 처리한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(1);
      mockedRecipe.findMany.mockResolvedValueOnce([
        makeRow({ ingredients: '{"foo":"bar"}' }),
      ]);

      const res = await request(app).get("/api/recipes");

      expect(res.body.recipes[0].ingredients).toEqual([]);
    });

    it("ingredients/steps가 손상된 JSON이면 빈 배열로 처리한다", async () => {
      mockedRecipe.count.mockResolvedValueOnce(1);
      mockedRecipe.findMany.mockResolvedValueOnce([
        makeRow({ ingredients: "{broken", steps: "{broken" }),
      ]);

      const res = await request(app).get("/api/recipes");

      expect(res.body.recipes[0].ingredients).toEqual([]);
      expect(res.body.recipes[0].steps).toEqual([]);
    });
  });

  describe("GET /api/recipes/mine", () => {
    it("토큰 없이 요청하면 401", async () => {
      const res = await request(app).get("/api/recipes/mine");
      expect(res.status).toBe(401);
    });

    it("인증된 사용자 소유 레시피만 조회한다", async () => {
      mockedRecipe.findMany.mockResolvedValueOnce([makeRow()]);

      const res = await request(app)
        .get("/api/recipes/mine")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockedRecipe.findMany.mock.calls[0][0].where).toEqual({
        authorId: "user-1",
      });
      expect(res.body.recipes).toHaveLength(1);
    });
  });

  describe("GET /api/recipes/:id", () => {
    it("존재하면 200과 상세 정보를 반환한다", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(makeRow());

      const res = await request(app).get("/api/recipes/recipe-1");

      expect(res.status).toBe(200);
      expect(res.body.recipe.id).toBe("recipe-1");
    });

    it("존재하지 않으면 404", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(null);

      const res = await request(app).get("/api/recipes/missing");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/recipes", () => {
    it("토큰 없이 요청하면 401", async () => {
      const res = await request(app)
        .post("/api/recipes")
        .send({ title: "x", description: "y" });
      expect(res.status).toBe(401);
    });

    it("제목이 없으면 400", async () => {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "설명만 있음" });
      expect(res.status).toBe(400);
    });

    it("성공하면 201과 생성된 레시피를 반환하고 ingredients/steps를 JSON 문자열로 저장한다", async () => {
      mockedRecipe.create.mockResolvedValueOnce(makeRow());

      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${token}`)
        .send({
          title: "토마토 파스타",
          description: "간단한 저녁 메뉴",
          ingredients: ["파스타", "토마토소스"],
          steps: ["면을 삶는다", "소스에 버무린다"],
        });

      expect(res.status).toBe(201);
      const createData = mockedRecipe.create.mock.calls[0][0].data;
      expect(createData.ingredients).toBe(JSON.stringify(["파스타", "토마토소스"]));
      expect(createData.authorId).toBe("user-1");
    });
  });

  describe("PUT /api/recipes/:id", () => {
    it("토큰 없이 요청하면 401", async () => {
      const res = await request(app)
        .put("/api/recipes/recipe-1")
        .send({ title: "x", description: "y" });
      expect(res.status).toBe(401);
    });

    it("레시피가 없으면 404", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .put("/api/recipes/missing")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "x", description: "y" });

      expect(res.status).toBe(404);
    });

    it("본인 레시피가 아니면 403", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(makeRow({ authorId: "user-1" }));

      const res = await request(app)
        .put("/api/recipes/recipe-1")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "x", description: "y" });

      expect(res.status).toBe(403);
    });

    it("유효하지 않은 body면 400", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(makeRow({ authorId: "user-1" }));

      const res = await request(app)
        .put("/api/recipes/recipe-1")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "", description: "" });

      expect(res.status).toBe(400);
    });

    it("성공하면 200과 수정된 레시피를 반환한다", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(makeRow({ authorId: "user-1" }));
      mockedRecipe.update.mockResolvedValueOnce(makeRow({ title: "수정된 제목" }));

      const res = await request(app)
        .put("/api/recipes/recipe-1")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "수정된 제목", description: "설명" });

      expect(res.status).toBe(200);
      expect(res.body.recipe.title).toBe("수정된 제목");
    });
  });

  describe("DELETE /api/recipes/:id", () => {
    it("토큰 없이 요청하면 401", async () => {
      const res = await request(app).delete("/api/recipes/recipe-1");
      expect(res.status).toBe(401);
    });

    it("레시피가 없으면 404", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(null);

      const res = await request(app)
        .delete("/api/recipes/missing")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("본인 레시피가 아니면 403", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(makeRow({ authorId: "user-1" }));

      const res = await request(app)
        .delete("/api/recipes/recipe-1")
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it("성공하면 204를 반환한다", async () => {
      mockedRecipe.findUnique.mockResolvedValueOnce(makeRow({ authorId: "user-1" }));
      mockedRecipe.delete.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .delete("/api/recipes/recipe-1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});
