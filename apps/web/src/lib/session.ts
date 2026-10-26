import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type SessionPayload = { sub: string; sid: string; role: string; exp: number };

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET must be at least 16 characters");
  return secret;
}

export function createSessionToken(
  user: { id: string; role: string; sessionId: string },
  secret = process.env.AUTH_SECRET,
  now = Date.now(),
): string {
  const key = requireSecret(secret);
  const payload: SessionPayload = {
    sub: user.id,
    sid: user.sessionId,
    role: user.role,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body, key)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret = process.env.AUTH_SECRET,
  now = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const key = requireSecret(secret);
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length) return null;

  const expected = Buffer.from(sign(body, key));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.role !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
