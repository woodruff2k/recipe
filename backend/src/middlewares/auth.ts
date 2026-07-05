import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { unauthorized } from "../utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Requires a valid `Authorization: Bearer <token>` header.
 * Populates req.userId / req.userEmail on success.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw unauthorized("Missing or malformed Authorization header");
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyToken(token);

    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    // Normalize JWT library errors into a 401.
    next(unauthorized("Invalid or expired token"));
  }
}
