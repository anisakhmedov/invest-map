import { createHash, randomBytes } from "node:crypto";

/** 24 random bytes as base64url: 32 characters, about 192 bits, so the link cannot be guessed. */
export function newTrackingToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashTrackingToken(token) };
}

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Lets pages skip the database for obviously wrong values. */
export function isPlausibleToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32}$/.test(token);
}
