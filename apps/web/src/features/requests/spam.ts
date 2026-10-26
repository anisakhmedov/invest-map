import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_FILL_MS = 3_000;
export const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;

function sign(timestamp: string, secret: string): string {
  return createHmac("sha256", `form:${secret}`).update(timestamp).digest("base64url");
}

/** A signed timestamp put into the form. Bots that post instantly, or replay old forms, are caught. */
export function createFormToken(secret: string, now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts, secret)}`;
}

export type FormTokenResult = "ok" | "too_fast" | "expired" | "invalid";

export function checkFormToken(token: unknown, secret: string, now = Date.now()): FormTokenResult {
  if (typeof token !== "string") return "invalid";
  const [ts, sig, ...rest] = token.split(".");
  if (!ts || !sig || rest.length || !/^\d{10,16}$/.test(ts)) return "invalid";
  const expected = Buffer.from(sign(ts, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return "invalid";
  const age = now - Number(ts);
  if (age < MIN_FILL_MS) return "too_fast";
  if (age > MAX_FORM_AGE_MS) return "expired";
  return "ok";
}

export function countLinks(text: string): number {
  return (text.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []).length;
}

export type SpamReason = "honeypot" | "too_many_links" | "repeated_characters" | "shouting";

/** Cheap content checks. They only look for obvious junk, so real people are very unlikely to trip them. */
export function spamReasons(input: { honeypot: string; subject: string; message: string }): SpamReason[] {
  const reasons: SpamReason[] = [];
  if (input.honeypot.trim() !== "") reasons.push("honeypot");
  const all = `${input.subject}\n${input.message}`;
  if (countLinks(all) > 2) reasons.push("too_many_links");
  if (/([\s\S])\1{29,}/.test(all)) reasons.push("repeated_characters");
  const letters = input.message.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 40) {
    const upper = letters.replace(/[^\p{Lu}]/gu, "").length;
    if (upper / letters.length > 0.8) reasons.push("shouting");
  }
  return reasons;
}
