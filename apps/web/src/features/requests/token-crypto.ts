import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// The database stores a hash of each tracking token for lookups, plus this encrypted copy so the
// server can put the link into later emails. A database leak alone does not reveal usable tokens.

function key(secret: string): Buffer {
  if (!secret || secret.length < 16) throw new Error("AUTH_SECRET must be at least 16 characters");
  return createHash("sha256").update(`tracking:${secret}`).digest();
}

/** AES-256-GCM. Output is base64url of iv (12) + auth tag (16) + ciphertext. */
export function encryptToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

/** Returns null for anything that was not produced by encryptToken with the same secret. */
export function decryptToken(encrypted: string, secret: string): string | null {
  try {
    const raw = Buffer.from(encrypted, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
