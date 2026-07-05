import { ZodError, z } from "zod";
import type { Response } from "express";
import { errorHandler, notFoundHandler } from "./error";
import { HttpError, forbidden } from "../utils/errors";

function makeRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("notFoundHandler", () => {
  it("404와 에러 메시지를 반환한다", () => {
    const res = makeRes();
    notFoundHandler({} as never, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Route not found" });
  });
});

describe("errorHandler", () => {
  it("ZodError면 400과 검증 상세를 반환한다", () => {
    const res = makeRes();
    let zodError: ZodError;
    try {
      z.object({ name: z.string() }).parse({});
      throw new Error("unreachable");
    } catch (err) {
      zodError = err as ZodError;
    }

    errorHandler(zodError, {} as never, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Validation failed" }),
    );
  });

  it("HttpError면 해당 statusCode와 메시지를 반환한다", () => {
    const res = makeRes();
    errorHandler(
      forbidden("You can only edit your own recipes"),
      {} as never,
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "You can only edit your own recipes",
    });
  });

  it("HttpError에 details가 있으면 함께 반환한다", () => {
    const res = makeRes();
    errorHandler(
      new HttpError(400, "bad input", { field: "email" }),
      {} as never,
      res,
      jest.fn(),
    );

    expect(res.json).toHaveBeenCalledWith({
      error: "bad input",
      details: { field: "email" },
    });
  });

  it("알 수 없는 에러면 500과 일반 메시지를 반환한다", () => {
    const res = makeRes();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(new Error("boom"), {} as never, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    consoleSpy.mockRestore();
  });
});
