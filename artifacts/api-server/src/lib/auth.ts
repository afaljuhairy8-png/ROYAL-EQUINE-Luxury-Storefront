import jwt, { type JwtPayload } from "jsonwebtoken";

export const AUTH_COOKIE_NAME = "royal_auth";
export const SESSION_ISSUER = "royal-equine";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured.");
    this.name = "AuthConfigurationError";
  }
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new AuthConfigurationError();
  return secret;
}

export function createSessionToken(userId: string): string {
  return jwt.sign({}, getJwtSecret(), {
    subject: userId,
    issuer: SESSION_ISSUER,
    expiresIn: "7d",
  });
}

export function readSessionToken(token: string): JwtPayload {
  const payload = jwt.verify(token, getJwtSecret(), { issuer: SESSION_ISSUER });
  if (typeof payload === "string" || !payload.sub) {
    throw new jwt.JsonWebTokenError("Invalid session payload.");
  }
  return payload;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api",
    maxAge: SESSION_MAX_AGE,
  };
}

export function sessionClearCookieOptions() {
  const { maxAge: _maxAge, ...options } = sessionCookieOptions();
  return options;
}
