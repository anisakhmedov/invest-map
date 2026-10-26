import { randomUUID } from "node:crypto";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowed uploads. SVG is excluded on purpose: it can carry scripts. */
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

const EXT: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

/** Detects the real type from file signature, ignoring the browser-declared one. */
export function sniffMime(buf: Uint8Array): AllowedMime | null {
  const starts = (...bytes: number[]) => bytes.every((b, i) => buf[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38) && (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61) return "image/gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return "image/webp";
  }
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  return null;
}

export type UploadCheck =
  | { ok: true; mime: AllowedMime }
  | { ok: false; reason: "empty" | "too_large" | "unsupported_type" };

export function checkUpload(buf: Uint8Array): UploadCheck {
  if (buf.length === 0) return { ok: false, reason: "empty" };
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "too_large" };
  const mime = sniffMime(buf);
  return mime ? { ok: true, mime } : { ok: false, reason: "unsupported_type" };
}

/** Keeps a readable, safe display name (no paths, no control chars). */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, 120);
}

export function buildObjectKey(mime: AllowedMime, now = new Date(), prefix = "media"): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${y}/${m}/${randomUUID()}.${EXT[mime]}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
