import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../next.config";

type Rule = { source: string; headers: { key: string; value: string }[] };
const env = process.env as Record<string, string | undefined>;
const original = env.NODE_ENV;
afterEach(() => {
  env.NODE_ENV = original;
});

async function rules(): Promise<Rule[]> {
  return (await nextConfig.headers!()) as Rule[];
}
const header = (r: Rule, key: string) => r.headers.find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("forbid framing, sniffing and leaky referrers on every page", async () => {
    env.NODE_ENV = "development";
    const [rule] = await rules();
    expect(header(rule, "X-Frame-Options")).toBe("DENY");
    expect(header(rule, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(rule, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header(rule, "Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(header(rule, "Content-Security-Policy")).toContain("object-src 'none'");
    expect(header(rule, "Permissions-Policy")).toContain("camera=()");
  });

  it("keeps the development policy light so hot reloading works", async () => {
    env.NODE_ENV = "development";
    const [rule] = await rules();
    expect(header(rule, "Content-Security-Policy")).not.toMatch(/script-src|default-src/);
  });

  it("locks production down to our own origin plus the two map hosts", async () => {
    env.NODE_ENV = "production";
    const csp = header((await rules())[0], "Content-Security-Policy")!;
    const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("script-src")).toBe("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("unsafe-eval");
    expect(directive("connect-src")).toContain("https://tile.openstreetmap.org");
    expect(directive("connect-src")).toContain("https://demotiles.maplibre.org");
    expect(directive("img-src")).toContain("https://tile.openstreetmap.org");
    expect(directive("worker-src")).toBe("worker-src 'self' blob:");
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-src 'none'"]) {
      expect(csp).toContain(d);
    }
    // plain http must keep working for local runs, so no automatic upgrade of every request
    expect(csp).not.toContain("upgrade-insecure-requests");
    // no wildcard sources anywhere
    expect(csp).not.toMatch(/\s\*(\s|;|$)/);
  });

  it("covers every route except /api/media, which sets its own sandboxed policy", async () => {
    const [rule] = await rules();
    // Next.js matches `source` with path-to-regexp; the negative lookahead part behaves like a plain RegExp.
    const source = new RegExp(`^${rule.source}$`);
    expect(source.test("/ru/admin")).toBe(true);
    expect(source.test("/api/invest/export")).toBe(true);
    expect(source.test("/api/media/abc")).toBe(false);
  });

  it("sends HSTS only in production", async () => {
    env.NODE_ENV = "development";
    expect(header((await rules())[0], "Strict-Transport-Security")).toBeUndefined();
    env.NODE_ENV = "production";
    expect(header((await rules())[0], "Strict-Transport-Security")).toContain("max-age=31536000");
  });
});
