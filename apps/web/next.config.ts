import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Self-contained server output for the Docker image.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    // Media uploads go through a Server Action: 10 MB file limit plus multipart overhead.
    serverActions: { bodySizeLimit: "11mb" },
  },
  async headers() {
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
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy", value: csp },
      ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
    ];
    // /api/media sets its own, stricter headers (sandboxed CSP) on every file it serves.
    return [{ source: "/((?!api/media).*)", headers }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
