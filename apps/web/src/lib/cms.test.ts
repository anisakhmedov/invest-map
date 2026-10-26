import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  buildObjectKey,
  checkUpload,
  formatBytes,
  sanitizeFilename,
  sniffMime,
} from "./media";
import { contactsSchema, pageInputSchema, pickLocalized, slugSchema, toParagraphs } from "./content";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("media sniffing", () => {
  it("detects supported types by signature", () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(sniffMime(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffMime(webp)).toBe("image/webp");
  });

  it("rejects SVG, HTML and executables even if renamed", () => {
    const enc = new TextEncoder();
    expect(sniffMime(enc.encode("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>"))).toBeNull();
    expect(sniffMime(enc.encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffMime(bytes(0x4d, 0x5a, 0x90))).toBeNull();
  });

  it("does not crash on tiny inputs", () => {
    expect(sniffMime(new Uint8Array([]))).toBeNull();
    expect(sniffMime(new Uint8Array([0xff]))).toBeNull();
  });

  it("checkUpload enforces size and emptiness", () => {
    expect(checkUpload(new Uint8Array([]))).toEqual({ ok: false, reason: "empty" });
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    expect(checkUpload(big)).toEqual({ ok: false, reason: "too_large" });
    expect(checkUpload(bytes(0xff, 0xd8, 0xff))).toEqual({ ok: true, mime: "image/jpeg" });
    expect(checkUpload(bytes(1, 2, 3))).toEqual({ ok: false, reason: "unsupported_type" });
  });
});

describe("media names", () => {
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\a\\plan?.png")).toBe("plan.png");
    expect(sanitizeFilename("  my   photo \u0000.jpg ")).toBe("my photo .jpg");
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("a".repeat(500)).length).toBe(120);
  });

  it("builds unique keys with a safe extension and date prefix", () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    const a = buildObjectKey("image/png", d);
    const b = buildObjectKey("image/png", d);
    expect(a).toMatch(/^media\/2026\/01\/[0-9a-f-]{36}\.png$/);
    expect(a).not.toBe(b);
    expect(buildObjectKey("application/pdf", d)).toMatch(/\.pdf$/);
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("localized content", () => {
  it("prefers the requested locale", () => {
    expect(pickLocalized({ uz: "salom", ru: "привет" }, "ru")).toEqual({ text: "привет", fallback: false });
  });

  it("falls back to uz, then to any filled language", () => {
    expect(pickLocalized({ uz: "salom", ru: "" }, "ru")).toEqual({ text: "salom", fallback: true });
    expect(pickLocalized({ en: "hello" }, "ru")).toEqual({ text: "hello", fallback: true });
  });

  it("handles junk values", () => {
    for (const v of [null, undefined, 5, "x", []]) {
      expect(pickLocalized(v, "uz")).toEqual({ text: "", fallback: false });
    }
  });

  it("splits paragraphs on blank lines", () => {
    expect(toParagraphs("a\nb\n\n\n c \r\n\r\nd")).toEqual(["a\nb", "c", "d"]);
    expect(toParagraphs("   ")).toEqual([]);
  });
});

describe("validation schemas", () => {
  it("accepts good slugs and rejects bad ones", () => {
    expect(slugSchema.parse(" About-Us ")).toBe("about-us");
    for (const bad of ["", "a", "-a", "a-", "a b", "a_b", "../x", "ä", "a--b"]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });

  const base = {
    kind: "PAGE" as const,
    slug: "about",
    title: { uz: "Haqida", oz: "", ru: "", en: "" },
    body: { uz: "", oz: "", ru: "", en: "" },
  };

  it("requires an uz title only for published pages", () => {
    expect(pageInputSchema.safeParse({ ...base, status: "DRAFT", title: { ...base.title, uz: "" } }).success).toBe(true);
    expect(pageInputSchema.safeParse({ ...base, status: "PUBLISHED", title: { ...base.title, uz: "" } }).success).toBe(false);
    expect(pageInputSchema.safeParse({ ...base, status: "PUBLISHED" }).success).toBe(true);
  });

  it("rejects unknown kinds and oversize text", () => {
    expect(pageInputSchema.safeParse({ ...base, status: "DRAFT", kind: "POST" }).success).toBe(false);
    expect(
      pageInputSchema.safeParse({ ...base, status: "DRAFT", title: { ...base.title, uz: "x".repeat(201) } }).success,
    ).toBe(false);
  });

  it("validates contacts", () => {
    const address = { uz: "", oz: "", ru: "", en: "" };
    expect(contactsSchema.safeParse({ email: "", phone: "", address }).success).toBe(true);
    expect(contactsSchema.safeParse({ email: "a@b.uz", phone: "+998 90 000 00 00", address }).success).toBe(true);
    expect(contactsSchema.safeParse({ email: "not-an-email", phone: "", address }).success).toBe(false);
  });
});
