import { SITE_URL } from "@/lib/seo";
import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import { decryptToken } from "./token-crypto";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be at least 16 characters");
  return s;
}

export function trackingUrl(locale: Locale, token: string): string {
  return `${SITE_URL}/${locale}/request/track/${token}`;
}

/** Rebuilds the visitor's private link, for emails that staff replies trigger later. */
export function trackingLinkFor(request: { trackingEnc: string; locale: string }): string | null {
  const token = decryptToken(request.trackingEnc, secret());
  return token ? trackingUrl(hasLocale(request.locale) ? request.locale : defaultLocale, token) : null;
}

export { secret as authSecret };
