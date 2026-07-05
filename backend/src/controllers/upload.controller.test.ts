import request from "supertest";
import { createApp } from "../app";
import { signToken } from "../utils/jwt";
import { storage } from "../storage";

jest.mock("../storage", () => ({
  storage: { save: jest.fn(), delete: jest.fn() },
}));

const mockedStorage = storage as unknown as { save: jest.Mock; delete: jest.Mock };

describe("POST /api/uploads/image", () => {
  const app = createApp();
  const token = signToken({ sub: "user-1", email: "a@b.com" });

  beforeEach(() => {
    mockedStorage.save.mockReset();
  });

  it("토큰 없이 요청하면 401", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .attach("image", Buffer.from("fake-bytes"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(401);
  });

  it("파일 없이 요청하면 400", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("허용되지 않는 파일 형식이면 400", async () => {
    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("not an image"), {
        filename: "note.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });

  it("허용된 이미지면 201과 key/url을 반환한다", async () => {
    mockedStorage.save.mockResolvedValueOnce({
      key: "abc.png",
      url: "http://localhost:4000/uploads/abc.png",
    });

    const res = await request(app)
      .post("/api/uploads/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("image", Buffer.from("fake-bytes"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      key: "abc.png",
      url: "http://localhost:4000/uploads/abc.png",
    });
  });
});
