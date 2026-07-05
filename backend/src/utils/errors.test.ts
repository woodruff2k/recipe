import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  HttpError,
} from "./errors";

describe("error factories", () => {
  it("badRequest는 400과 메시지를 갖는 HttpError를 만든다", () => {
    const err = badRequest("bad input", { field: "email" });
    expect(err).toBeInstanceOf(HttpError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe("bad input");
    expect(err.details).toEqual({ field: "email" });
  });

  it("conflict는 409를 만든다", () => {
    expect(conflict("dup").statusCode).toBe(409);
  });

  it("메시지를 생략하면 각 팩토리의 기본 메시지를 사용한다", () => {
    expect(unauthorized()).toMatchObject({ statusCode: 401, message: "Unauthorized" });
    expect(forbidden()).toMatchObject({ statusCode: 403, message: "Forbidden" });
    expect(notFound()).toMatchObject({ statusCode: 404, message: "Not found" });
  });
});
