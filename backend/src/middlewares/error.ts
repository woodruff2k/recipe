import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";

/** 404 handler for unmatched routes. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found" });
}

/** Central error handler — must be registered last, with 4 args. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Unknown / unexpected error — log server-side, return generic message.
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "Internal server error" });
}
