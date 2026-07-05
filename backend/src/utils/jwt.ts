import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  sub: string; // user id
  email: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as SignOptions);
}

/**
 * Verifies and decodes a JWT.
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError} on invalid/expired token.
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string" || !("sub" in decoded)) {
    throw new jwt.JsonWebTokenError("Malformed token payload");
  }
  return { sub: String(decoded.sub), email: String(decoded.email) };
}
