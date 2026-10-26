root = "D:/WORK/InvestMap/apps/web/"


def edit(path, pairs):
    p = root + path
    s = open(p, encoding="utf8").read()
    for a, b in pairs:
        assert a in s, (path, a[:70])
        s = s.replace(a, b, 1)
    open(p, "w", encoding="utf8").write(s)


edit("next.config.ts", [
    ('''  async headers() {
    const headers = [''', '''  async headers() {
    const production = process.env.NODE_ENV === "production";
    // Production policy: only our own origin plus the two map hosts. No eval and no foreign scripts.
    // Inline scripts stay allowed because Next.js streams page data in them; a nonce-based policy would
    // make every page dynamic and uncacheable. Development needs eval for hot reloading, so it keeps
    // the lighter policy.
    const csp = production
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://tile.openstreetmap.org",
          "font-src 'self' data:",
          "connect-src 'self' https://tile.openstreetmap.org https://demotiles.maplibre.org",
          "worker-src 'self' blob:",
          "child-src 'self' blob:",
          "frame-src 'none'",
          "media-src 'none'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join("; ")
      : "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";
    const headers = ['''),
    ('''      // Directives that do not depend on inline scripts, so Next.js hydration keeps working.
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),''', '''      { key: "Content-Security-Policy", value: csp },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),'''),
])

edit("src/security-headers.test.ts", [
    ('''  it("does not block the inline scripts Next.js hydration needs", async () => {
    const [rule] = await rules();
    expect(header(rule, "Content-Security-Policy")).not.toMatch(/script-src|default-src/);
  });''', '''  it("keeps the development policy light so hot reloading works", async () => {
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
    expect(csp).not.toMatch(/\\s\\*(\\s|;|$)/);
  });'''),
    ('''    const [rule] = await rules();
    expect(header(rule, "X-Frame-Options")).toBe("DENY");''', '''    env.NODE_ENV = "development";
    const [rule] = await rules();
    expect(header(rule, "X-Frame-Options")).toBe("DENY");'''),
])
print("ok")
