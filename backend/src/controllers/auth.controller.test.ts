import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../app";
import { signToken } from "../utils/jwt";
import { prisma } from "../lib/prisma";

// 프로필 수정(PATCH /api/auth/me)은 아직 라우트가 없다 — RED 단계.
// DB 없이 컨트롤러 로직만 검증하기 위해 prisma를 목 처리한다(app.test.ts와 동일한
// "DB 미의존 경로" 원칙, 다만 여기선 update 로직 자체가 검증 대상이라 mock으로 대체).
jest.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockedUser = prisma.user as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
  create: jest.Mock;
};

describe("PATCH /api/auth/me", () => {
  const app = createApp();
  const token = signToken({ sub: "user-1", email: "old@example.com" });

  beforeEach(() => {
    mockedUser.findUnique.mockReset();
    mockedUser.update.mockReset();
  });

  it("토큰 없이 요청하면 401", async () => {
    const res = await request(app).patch("/api/auth/me").send({ name: "New Name" });
    expect(res.status).toBe(401);
  });

  it("이름을 수정하면 200과 갱신된 공개 사용자 정보를 반환한다", async () => {
    mockedUser.update.mockResolvedValueOnce({
      id: "user-1",
      email: "old@example.com",
      name: "New Name",
    });

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: "user-1",
      email: "old@example.com",
      name: "New Name",
    });
    // 비밀번호 해시 등 민감 정보는 응답에 포함되면 안 된다.
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it("잘못된 이메일 형식이면 400", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("빈 body(수정할 필드 없음)면 400", async () => {
    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("다른 사용자가 이미 쓰는 이메일로 변경하면 409", async () => {
    mockedUser.findUnique.mockResolvedValueOnce({
      id: "other-user",
      email: "taken@example.com",
    });

    const res = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "taken@example.com" });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/register", () => {
  const app = createApp();

  beforeEach(() => {
    mockedUser.findUnique.mockReset();
    mockedUser.create.mockReset();
  });

  it("이메일·비밀번호·이름으로 가입하면 201과 토큰+공개 사용자 정보를 반환한다", async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null);
    mockedUser.create.mockResolvedValueOnce({
      id: "new-user-1",
      email: "new@example.com",
      name: "New User",
      passwordHash: "hashed",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@example.com", password: "password123", name: "New User" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: "new-user-1",
      email: "new@example.com",
      name: "New User",
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  // 비밀번호 해싱 자체는 UserService의 책임 영역이라 services/user.service.test.ts에서
  // 실제 bcrypt.compare로 검증한다. 여기서는 HTTP 계약(상태 코드/응답 형태)만 확인한다.

  it("이미 가입된 이메일이면 409", async () => {
    mockedUser.findUnique.mockResolvedValueOnce({
      id: "existing-user",
      email: "dup@example.com",
      name: "Existing",
      passwordHash: "x",
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@example.com", password: "password123", name: "Dup User" });

    expect(res.status).toBe(409);
  });

  it("이메일 형식이 잘못되면 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123", name: "Bad Email" });

    expect(res.status).toBe(400);
  });

  it("비밀번호가 8자 미만이면 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short-pw@example.com", password: "short1", name: "Short PW" });

    expect(res.status).toBe(400);
  });

  it("이름이 없으면 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "no-name@example.com", password: "password123" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  const app = createApp();

  beforeEach(() => {
    mockedUser.findUnique.mockReset();
  });

  it("이메일/비밀번호가 맞으면 200과 토큰을 반환한다", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    mockedUser.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "a@b.com",
      name: "A",
      passwordHash,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: "user-1", email: "a@b.com", name: "A" });
  });

  it("존재하지 않는 이메일이면 401", async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
  });

  it("비밀번호가 틀리면 401", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);
    mockedUser.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "a@b.com",
      name: "A",
      passwordHash,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("이메일 형식이 잘못되면 400", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
  });

  it("비밀번호가 없으면 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@b.com" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/me", () => {
  const app = createApp();
  const token = signToken({ sub: "user-1", email: "a@b.com" });

  beforeEach(() => {
    mockedUser.findUnique.mockReset();
  });

  it("토큰 없이 요청하면 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("유효한 토큰이면 200과 공개 사용자 정보를 반환한다", async () => {
    mockedUser.findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "a@b.com",
      name: "A",
      passwordHash: "x",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: "user-1", email: "a@b.com", name: "A" });
  });

  it("토큰은 유효하지만 사용자가 더 이상 존재하지 않으면 401", async () => {
    mockedUser.findUnique.mockResolvedValueOnce(null);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
