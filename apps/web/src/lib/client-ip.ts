const IP_LIKE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * Picks the client address from an X-Forwarded-For header.
 *
 * A client can put anything at the start of this header, but our own reverse proxy appends the
 * address it actually saw to the end, so the LAST entry is the only one worth trusting. Without a
 * proxy the header is absent and every request is bucketed as "unknown" (fine for local development).
 */
export function clientIpFrom(forwardedFor: string | null | undefined): string {
  const last = forwardedFor?.split(",").pop()?.trim() ?? "";
  const bare = last.replace(/^::ffff:/i, "");
  return IP_LIKE.test(bare) ? bare : "unknown";
}
