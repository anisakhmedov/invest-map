import { describe, expect, it } from "vitest";
import { REQUEST_PAGE_SIZE, applyRequestQuery, parseRequestQuery, serializeRequestQuery, type RequestRow } from "./admin-query";

const now = new Date("2027-03-10T00:00:00Z");
const row = (over: Partial<RequestRow>): RequestRow => ({
  id: "x",
  number: 1,
  subject: "Question about a plot",
  contactName: "Aziz Karimov",
  contactEmail: "aziz@example.uz",
  status: "NEW",
  assigneeId: null,
  assigneeName: null,
  dueAt: new Date("2027-03-20T00:00:00Z"),
  createdAt: new Date("2027-03-01T00:00:00Z"),
  ...over,
});

const rows = [
  row({ id: "a", number: 1, subject: "Plot near the highway", createdAt: new Date("2027-03-01T00:00:00Z") }),
  row({ id: "b", number: 2, subject: "Auction terms", contactName: "Dilnoza", contactEmail: "dil@example.uz", status: "IN_PROGRESS", assigneeId: "u1", createdAt: new Date("2027-03-02T00:00:00Z"), dueAt: new Date("2027-03-05T00:00:00Z") }),
  row({ id: "c", number: 12, subject: "Thanks", status: "CLOSED", assigneeId: "u2", createdAt: new Date("2027-03-03T00:00:00Z"), dueAt: new Date("2027-03-04T00:00:00Z") }),
];

const q = (qs: string) => parseRequestQuery(new URLSearchParams(qs));
const ids = (qs: string, me = "u1") => applyRequestQuery(rows, q(qs), me, now).items.map((r) => r.id);

describe("request list query", () => {
  it("defaults to newest first", () => {
    expect(ids("")).toEqual(["c", "b", "a"]);
  });

  it("filters by status, assignee and overdue", () => {
    expect(ids("status=NEW")).toEqual(["a"]);
    expect(ids("assignee=me", "u1")).toEqual(["b"]);
    expect(ids("assignee=me", "u2")).toEqual(["c"]);
    expect(ids("assignee=none")).toEqual(["a"]);
    expect(ids("assignee=u2")).toEqual(["c"]);
    expect(ids("overdue=1")).toEqual(["b"]); // closed requests are never overdue, "a" still has time
  });

  it("finds by number (with or without #), subject, name or email", () => {
    expect(ids("q=12")).toEqual(["c"]);
    expect(ids("q=%232")).toEqual(["b"]);
    expect(ids("q=highway")).toEqual(["a"]);
    expect(ids("q=dilnoza")).toEqual(["b"]);
    expect(ids("q=dil@example")).toEqual(["b"]);
    expect(ids("q=nothing-like-this")).toEqual([]);
  });

  it("sorts by deadline and number in both directions", () => {
    expect(ids("sort=due")).toEqual(["c", "b", "a"]);
    expect(ids("sort=-number")).toEqual(["c", "b", "a"]);
    expect(ids("sort=number")).toEqual(["a", "b", "c"]);
  });

  it("ignores junk parameters", () => {
    expect(q("status=HACK&assignee=<x>&sort=;drop&page=-2&overdue=yes")).toMatchObject({
      status: "",
      assignee: "",
      overdue: false,
      page: 1,
      sort: { key: "created", dir: "desc" },
    });
    expect(parseRequestQuery(new URLSearchParams({ q: "x".repeat(300) })).q).toHaveLength(100);
  });

  it("paginates", () => {
    const many = Array.from({ length: REQUEST_PAGE_SIZE + 3 }, (_, i) => row({ id: String(i), number: i + 1 }));
    const second = applyRequestQuery(many, q("page=2"), "u1", now);
    expect(second).toMatchObject({ page: 2, pages: 2, total: REQUEST_PAGE_SIZE + 3 });
    expect(second.items).toHaveLength(3);
  });

  it("serializes only non-default values and round-trips", () => {
    expect(serializeRequestQuery(q(""))).toBe("");
    const original = q("q=plot&status=ANSWERED&assignee=me&overdue=1&sort=-due&page=2");
    expect(q(serializeRequestQuery(original))).toEqual(original);
  });
});
