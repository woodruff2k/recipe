import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { signToken, verifyToken } from "./jwt";

describe("jwt utils", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signToken({ sub: "user-1", email: "a@b.com" });
    expect(typeof token).toBe("string");

    const payload = verifyToken(token);
    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
  });

  it("throws on a malformed token", () => {
    expect(() => verifyToken("not-a-jwt")).toThrow();
  });

  it("sub 클레임이 없는 토큰은 malformed로 처리한다", () => {
    const tokenWithoutSub = jwt.sign({ email: "a@b.com" }, env.jwtSecret);
    expect(() => verifyToken(tokenWithoutSub)).toThrow("Malformed token payload");
  });

  it("문자열 payload로 서명된 토큰(디코딩 결과가 string)도 malformed로 처리한다", () => {
    const stringPayloadToken = jwt.sign("just-a-string", env.jwtSecret);
    expect(() => verifyToken(stringPayloadToken)).toThrow("Malformed token payload");
  });
});
