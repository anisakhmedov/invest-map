import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function run(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers }));
}

function location(res: ReturnType<typeof run>) {
  const loc = res?.headers.get("location");
  return loc ? new URL(loc).pathname : null;
}

describe("proxy locale routing", () => {
  it("passes through paths that already have a locale", () => {
    for (const p of ["/uz", "/ru/map", "/en/projects/1", "/oz/news"]) {
      expect(run(p)).toBeUndefined();
    }
  });

  it("redirects / to the default locale without Accept-Language", () => {
    const res = run("/");
    expect(res?.status).toBe(307);
    expect(location(res)).toBe("/uz");
  });

  it("keeps the rest of the path when adding a locale", () => {
    expect(location(run("/map/42", { "accept-language": "ru" }))).toBe("/ru/map/42");
  });

  it("uses Accept-Language, respecting order", () => {
    expect(location(run("/", { "accept-language": "en-US,en;q=0.9,ru;q=0.8" }))).toBe("/en");
    expect(location(run("/", { "accept-language": "ru-RU,ru;q=0.9" }))).toBe("/ru");
  });

  it("maps uz-Cyrl to the Cyrillic locale", () => {
    expect(location(run("/", { "accept-language": "uz-Cyrl-UZ,uz;q=0.8" }))).toBe("/oz");
  });

  it("falls back to default for unsupported languages", () => {
    expect(location(run("/", { "accept-language": "de-DE,fr;q=0.8" }))).toBe("/uz");
  });

  it("prefers the locale cookie over Accept-Language", () => {
    const res = run("/", { "accept-language": "en", cookie: "locale=ru" });
    expect(location(res)).toBe("/ru");
  });

  it("ignores an invalid locale cookie", () => {
    const res = run("/", { "accept-language": "en", cookie: "locale=xx" });
    expect(location(res)).toBe("/en");
  });

  it("does not treat lookalike prefixes as locales", () => {
    expect(location(run("/ruby"))).toBe("/uz/ruby");
    expect(location(run("/english/page"))).toBe("/uz/english/page");
  });
});
