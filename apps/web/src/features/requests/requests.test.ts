import { describe, expect, it } from "vitest";
import { requestInputSchema, staffReplySchema, taskInputSchema, visitorReplySchema } from "./schemas";
import {
  MAX_FORM_AGE_MS,
  MIN_FILL_MS,
  checkFormToken,
  countLinks,
  createFormToken,
  spamReasons,
} from "./spam";
import { hashTrackingToken, isPlausibleToken, newTrackingToken } from "./tracking";
import { decryptToken, encryptToken } from "./token-crypto";
import {
  DEFAULT_SLA_HOURS,
  computeDueAt,
  firstResponseAfter,
  isOverdue,
  statusAfterStaffMessage,
  statusAfterVisitorMessage,
} from "./sla";
import { buildReport, parseDateRange, type ReportRow } from "./reports";
import { excerpt, fillTemplate, renderMail, sanitizeSubject } from "./mail";

const SECRET = "test-secret-at-least-16-chars";

describe("request input", () => {
  const good = {
    subject: "Land plot question",
    message: "Is the plot near the highway still available?",
    contactName: "Aziz",
    contactEmail: "  Aziz@Example.UZ ",
    contactPhone: "+998 (90) 123-45-67",
    objectId: "",
    locale: "uz",
  };

  it("accepts a normal request and normalizes the email", () => {
    const r = requestInputSchema.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contactEmail).toBe("aziz@example.uz");
  });

  it("rejects short, long, malformed and unknown values", () => {
    const bad = (over: object) => requestInputSchema.safeParse({ ...good, ...over }).success;
    expect(bad({ subject: "hi" })).toBe(false);
    expect(bad({ message: "too short" })).toBe(false);
    expect(bad({ message: "x".repeat(5001) })).toBe(false);
    expect(bad({ contactName: "A" })).toBe(false);
    expect(bad({ contactEmail: "nope" })).toBe(false);
    expect(bad({ contactPhone: "call me maybe" })).toBe(false);
    expect(bad({ locale: "de" })).toBe(false);
    expect(bad({ contactPhone: "" })).toBe(true);
  });

  it("validates replies and tasks", () => {
    expect(visitorReplySchema.safeParse({ body: "  " }).success).toBe(false);
    expect(visitorReplySchema.safeParse({ body: "Thanks" }).success).toBe(true);
    expect(staffReplySchema.safeParse({ body: "Hello", internal: true }).success).toBe(true);
    expect(staffReplySchema.safeParse({ body: "Hello" }).success).toBe(false);
    const task = { title: "Call the owner", description: "", status: "TODO", dueAt: null, assigneeId: null, requestId: null };
    expect(taskInputSchema.safeParse(task).success).toBe(true);
    const withDate = taskInputSchema.safeParse({ ...task, dueAt: "2027-05-01T10:00:00Z" });
    expect(withDate.success && withDate.data.dueAt instanceof Date).toBe(true);
    expect(taskInputSchema.safeParse({ ...task, dueAt: "garbage" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...task, status: "WAITING" }).success).toBe(false);
  });
});

describe("form token", () => {
  const t0 = 1_800_000_000_000;
  const token = createFormToken(SECRET, t0);

  it("accepts a form submitted after a human delay", () => {
    expect(checkFormToken(token, SECRET, t0 + MIN_FILL_MS + 1)).toBe("ok");
    expect(checkFormToken(token, SECRET, t0 + MAX_FORM_AGE_MS - 1)).toBe("ok");
  });

  it("rejects instant posts and stale forms", () => {
    expect(checkFormToken(token, SECRET, t0 + 500)).toBe("too_fast");
    expect(checkFormToken(token, SECRET, t0 + MAX_FORM_AGE_MS + 1)).toBe("expired");
  });

  it("rejects forged, tampered and missing tokens", () => {
    expect(checkFormToken(createFormToken("another-secret-16-chars!", t0), SECRET, t0 + 10_000)).toBe("invalid");
    const [, sig] = token.split(".");
    expect(checkFormToken(`${t0 - 10 * MAX_FORM_AGE_MS}.${sig}`, SECRET, t0 + 10_000)).toBe("invalid");
    for (const bad of [undefined, null, "", "abc", "1.2.3", `${t0}.`, 42]) expect(checkFormToken(bad, SECRET, t0 + 10_000)).toBe("invalid");
  });
});

describe("spam heuristics", () => {
  const ok = { honeypot: "", subject: "Question", message: "Please tell me about the plot near Samarkand." };

  it("lets normal messages through, including a link or two", () => {
    expect(spamReasons(ok)).toEqual([]);
    expect(spamReasons({ ...ok, message: `${ok.message} See https://example.uz/a and www.example.uz/b` })).toEqual([]);
  });

  it("flags honeypot, link floods, repeated characters and shouting", () => {
    expect(spamReasons({ ...ok, honeypot: "http://x" })).toContain("honeypot");
    expect(spamReasons({ ...ok, message: "http://a.co http://b.co https://c.co www.d.co" })).toContain("too_many_links");
    expect(spamReasons({ ...ok, message: "a".repeat(40) })).toContain("repeated_characters");
    expect(spamReasons({ ...ok, message: "BUY CHEAP WATCHES NOW BEST PRICE GUARANTEED TODAY ONLY CLICK" })).toContain("shouting");
  });

  it("does not shout-flag short capitals or caseless scripts", () => {
    expect(spamReasons({ ...ok, message: "ASAP please, plot A12 near the M39 road" })).toEqual([]);
    expect(spamReasons({ ...ok, message: "今日は土地について質問があります。詳しく教えてください。よろしくお願いします。ありがとう" })).toEqual([]);
  });

  it("counts links", () => {
    expect(countLinks("no links")).toBe(0);
    expect(countLinks("http://a.uz, https://b.uz and www.c.uz")).toBe(3);
  });
});

describe("tracking token", () => {
  it("is long, unique and stored only as a hash", () => {
    const a = newTrackingToken();
    const b = newTrackingToken();
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashTrackingToken(a.token));
    expect(a.hash).not.toContain(a.token);
  });

  it("recognizes plausible tokens only", () => {
    expect(isPlausibleToken(newTrackingToken().token)).toBe(true);
    for (const bad of ["", "short", "x".repeat(33), "has space has space has space 1234", undefined, 5, "../../etc/passwd/../../xxxx"]) {
      expect(isPlausibleToken(bad)).toBe(false);
    }
  });
});

describe("tracking token encryption", () => {
  const token = newTrackingToken().token;

  it("round-trips with the same secret and produces a different ciphertext each time", () => {
    const a = encryptToken(token, SECRET);
    const b = encryptToken(token, SECRET);
    expect(a).not.toBe(b);
    expect(a).not.toContain(token);
    expect(decryptToken(a, SECRET)).toBe(token);
    expect(decryptToken(b, SECRET)).toBe(token);
  });

  it("refuses wrong secrets, tampering and junk", () => {
    const enc = encryptToken(token, SECRET);
    expect(decryptToken(enc, "another-secret-16-chars!")).toBeNull();
    const flipped = enc.slice(0, -2) + (enc.endsWith("AA") ? "BB" : "AA");
    expect(decryptToken(flipped, SECRET)).toBeNull();
    for (const bad of ["", "abc", "x".repeat(100), "%%%"]) expect(decryptToken(bad, SECRET)).toBeNull();
  });

  it("will not work with a weak secret", () => {
    expect(() => encryptToken(token, "short")).toThrow();
  });
});

describe("SLA and status rules", () => {
  const created = new Date("2027-01-01T00:00:00Z");

  it("computes the deadline and falls back to the default for bad hours", () => {
    expect(computeDueAt(created, 48).toISOString()).toBe("2027-01-03T00:00:00.000Z");
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(computeDueAt(created, bad).getTime() - created.getTime()).toBe(DEFAULT_SLA_HOURS * 3_600_000);
    }
    expect(computeDueAt(created, 1e9).getTime() - created.getTime()).toBe(24 * 60 * 3_600_000); // capped
  });

  it("is overdue only while open and past the deadline", () => {
    const dueAt = new Date("2027-01-03T00:00:00Z");
    const late = new Date("2027-01-04T00:00:00Z");
    expect(isOverdue({ status: "NEW", dueAt }, late)).toBe(true);
    expect(isOverdue({ status: "IN_PROGRESS", dueAt }, late)).toBe(true);
    expect(isOverdue({ status: "ANSWERED", dueAt }, late)).toBe(false);
    expect(isOverdue({ status: "CLOSED", dueAt }, late)).toBe(false);
    expect(isOverdue({ status: "NEW", dueAt }, new Date("2027-01-02T00:00:00Z"))).toBe(false);
  });

  it("staff replies answer the request, internal notes do not change it", () => {
    expect(statusAfterStaffMessage("NEW", false)).toBe("ANSWERED");
    expect(statusAfterStaffMessage("CLOSED", false)).toBe("ANSWERED");
    expect(statusAfterStaffMessage("IN_PROGRESS", true)).toBe("IN_PROGRESS");
    expect(statusAfterStaffMessage("NEW", true)).toBe("NEW");
  });

  it("records only the first public reply as the first response", () => {
    const now = new Date("2027-01-02T00:00:00Z");
    const earlier = new Date("2027-01-01T05:00:00Z");
    expect(firstResponseAfter(null, false, now)).toBe(now);
    expect(firstResponseAfter(null, true, now)).toBeNull();
    expect(firstResponseAfter(earlier, false, now)).toBe(earlier);
  });

  it("lets visitors follow up until closed, reopening answered requests", () => {
    expect(statusAfterVisitorMessage("NEW")).toEqual({ allowed: true, status: "NEW" });
    expect(statusAfterVisitorMessage("IN_PROGRESS")).toEqual({ allowed: true, status: "IN_PROGRESS" });
    expect(statusAfterVisitorMessage("ANSWERED")).toEqual({ allowed: true, status: "IN_PROGRESS" });
    expect(statusAfterVisitorMessage("CLOSED")).toEqual({ allowed: false });
  });
});

describe("buildReport", () => {
  const now = new Date("2027-03-10T00:00:00Z");
  const row = (over: Partial<ReportRow>): ReportRow => ({
    createdAt: new Date("2027-03-01T00:00:00Z"),
    status: "NEW",
    dueAt: new Date("2027-03-04T00:00:00Z"),
    firstResponseAt: null,
    closedAt: null,
    regionId: "r1",
    ...over,
  });

  it("returns zeros and nulls for no data", () => {
    const r = buildReport([], now);
    expect(r).toMatchObject({ total: 0, overdue: 0, avgFirstResponseHours: null, slaMetPercent: null, byMonth: [], byRegion: [] });
    expect(r.byStatus).toEqual({ NEW: 0, IN_PROGRESS: 0, ANSWERED: 0, CLOSED: 0 });
  });

  it("counts statuses, overdue, months (Tashkent time) and regions", () => {
    const r = buildReport(
      [
        row({}), // open and late
        row({ status: "ANSWERED", firstResponseAt: new Date("2027-03-02T00:00:00Z") }),
        row({ status: "CLOSED", firstResponseAt: new Date("2027-03-02T12:00:00Z"), regionId: "r2" }),
        row({ createdAt: new Date("2027-02-28T20:00:00Z"), regionId: null, status: "IN_PROGRESS", dueAt: new Date("2027-03-20T00:00:00Z") }),
      ],
      now,
    );
    expect(r.total).toBe(4);
    expect(r.byStatus).toEqual({ NEW: 1, IN_PROGRESS: 1, ANSWERED: 1, CLOSED: 1 });
    expect(r.overdue).toBe(1);
    // 20:00 UTC on Feb 28 is already March 1 in Tashkent (UTC+5).
    expect(r.byMonth).toEqual([{ month: "2027-03", count: 4 }]);
    expect(r.byRegion).toEqual([{ regionId: "r1", count: 2 }, { regionId: "r2", count: 1 }, { regionId: null, count: 1 }].sort((a, b) => b.count - a.count));
  });

  it("averages the first response time and measures the SLA target", () => {
    const r = buildReport(
      [
        row({ firstResponseAt: new Date("2027-03-01T10:00:00Z"), status: "ANSWERED" }), // 10 h, in time
        row({ firstResponseAt: new Date("2027-03-02T14:00:00Z"), status: "ANSWERED" }), // 38 h, in time
        row({ firstResponseAt: new Date("2027-03-06T00:00:00Z"), status: "ANSWERED" }), // 120 h, late
        row({}), // still waiting and overdue: counts against the target
      ],
      now,
    );
    expect(r.avgFirstResponseHours).toBe(56);
    expect(r.slaMetPercent).toBe(50); // 2 of 4
  });

  it("does not count requests that are still within their deadline against the target", () => {
    const r = buildReport([row({ dueAt: new Date("2027-03-20T00:00:00Z") })], now);
    expect(r.slaMetPercent).toBeNull();
    expect(r.overdue).toBe(0);
  });
});

describe("mail helpers", () => {
  it("fills placeholders once and leaves unknown ones alone", () => {
    expect(fillTemplate("Hello {name}, request #{number} {unknown}", { name: "Aziz", number: 42 })).toBe("Hello Aziz, request #42 {unknown}");
    expect(fillTemplate("{a}", { a: "{b}", b: "no" })).toBe("{b}"); // values are not expanded again
  });

  it("strips line breaks from subjects", () => {
    expect(sanitizeSubject("Hi\r\nBcc: evil@x.com")).toBe("Hi Bcc: evil@x.com");
    expect(sanitizeSubject("x".repeat(500))).toHaveLength(200);
  });

  it("cuts long excerpts on a word boundary", () => {
    expect(excerpt("short   text\nhere")).toBe("short text here");
    const long = excerpt("word ".repeat(200), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/wor…$/);
  });

  it("renders subject and body together", () => {
    const m = renderMail({ subject: "Request #{number}\r\n", body: "Link: {url}" }, { number: 7, url: "https://x.uz/t" });
    expect(m).toEqual({ subject: "Request #7", body: "Link: https://x.uz/t" });
  });
});

describe("parseDateRange", () => {
  it("turns calendar days into Tashkent-time bounds with an inclusive end day", () => {
    const r = parseDateRange("2027-03-01", "2027-03-31");
    expect(r.from?.toISOString()).toBe("2027-02-28T19:00:00.000Z");
    expect(r.to?.toISOString()).toBe("2027-03-31T19:00:00.000Z"); // exclusive bound = start of April 1 in Tashkent
  });

  it("allows open-ended ranges", () => {
    expect(parseDateRange("2027-03-01", null).to).toBeNull();
    expect(parseDateRange(null, "2027-03-01").from).toBeNull();
    expect(parseDateRange(undefined, undefined)).toEqual({ from: null, to: null });
  });

  it("ignores invalid dates and reversed ranges", () => {
    expect(parseDateRange("2027-02-30", "garbage")).toEqual({ from: null, to: null });
    expect(parseDateRange("2027-03-10", "2027-03-01")).toEqual({ from: null, to: null });
    expect(parseDateRange("2027-03-05", "2027-03-05").to?.getTime()).toBeGreaterThan(parseDateRange("2027-03-05", "2027-03-05").from!.getTime());
  });
});
