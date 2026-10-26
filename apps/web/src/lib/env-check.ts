const REQUIRED = ["DATABASE_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY", "AUTH_SECRET", "NEXT_PUBLIC_SITE_URL"] as const;

const PLACEHOLDER = /change-?me|investmap_dev|example|secret123|password/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])$/;

/**
 * Settings a production server must not start without. Returns human-readable problems (empty = fine).
 * Values are never echoed back, so the messages are safe to put in logs.
 */
export function productionEnvProblems(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED) {
    if (!env[name]) problems.push(`${name} is not set`);
  }

  const secret = env.AUTH_SECRET;
  if (secret) {
    if (secret.length < 32) problems.push("AUTH_SECRET must be at least 32 characters (try: openssl rand -base64 48)");
    else if (PLACEHOLDER.test(secret)) problems.push("AUTH_SECRET still looks like a placeholder");
  }

  for (const name of ["S3_SECRET_KEY"] as const) {
    const v = env[name];
    if (v && PLACEHOLDER.test(v)) problems.push(`${name} still looks like a development default`);
  }
  if (env.DATABASE_URL && /investmap_dev/.test(env.DATABASE_URL)) problems.push("DATABASE_URL still uses the development password");

  const site = env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      const url = new URL(site);
      if (url.protocol !== "https:" && !LOCAL_HOST.test(url.hostname)) problems.push("NEXT_PUBLIC_SITE_URL must use https:// on a real domain");
    } catch {
      problems.push("NEXT_PUBLIC_SITE_URL is not a valid address");
    }
  }
  return problems;
}
