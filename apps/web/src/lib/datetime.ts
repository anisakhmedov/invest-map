// Uzbekistan uses a single fixed offset (UTC+5, no daylight saving), so dates can be converted
// with plain arithmetic and give the same result in every browser and on the server.
const OFFSET_MS = 5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Formats a Date as the value of an <input type="datetime-local"> in Tashkent time. */
export function toTashkentInput(date: Date): string {
  const t = new Date(date.getTime() + OFFSET_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** Turns a Tashkent datetime-local value into an ISO timestamp, or null when it is not a valid date. */
export function fromTashkentInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS;
  const check = new Date(utc + OFFSET_MS);
  // Reject overflowing values such as February 31st that Date.UTC would silently roll over.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return new Date(utc).toISOString();
}

export function formatTashkent(date: Date, locale: string, withTime = true): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Tashkent",
  }).format(date);
}
