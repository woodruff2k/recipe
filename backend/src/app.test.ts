import request from "supertest";
import { createApp } from "./app";

// DB 없이 동작하는 경로만 검증(/health, 404). DB 의존 라우트는 통합테스트에서
// 일회용 Postgres(dev `db` 또는 testcontainers)로 다룬다.
describe("app", () => {
  const app = createApp();

  it("GET /health → 200 ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("unknown route → 404 json", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("protected route without token → 401", async () => {
    const res = await request(app)
      .post("/api/recipes")
      .send({ title: "x", description: "y" });
    expect(res.status).toBe(401);
  });
});
