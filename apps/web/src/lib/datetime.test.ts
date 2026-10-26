import { describe, expect, it } from "vitest";
import { formatTashkent, fromTashkentInput, toTashkentInput } from "./datetime";

describe("Tashkent datetime helpers", () => {
  it("converts between local input values and UTC", () => {
    expect(fromTashkentInput("2027-03-01T09:00")).toBe("2027-03-01T04:00:00.000Z");
    expect(toTashkentInput(new Date("2027-03-01T04:00:00Z"))).toBe("2027-03-01T09:00");
  });

  it("round-trips across midnight and year boundaries", () => {
    for (const v of ["2026-12-31T23:59", "2027-01-01T00:00", "2028-02-29T03:30", "2027-06-15T04:59"]) {
      expect(toTashkentInput(new Date(fromTashkentInput(v)!))).toBe(v);
    }
    expect(fromTashkentInput("2027-01-01T02:00")).toBe("2026-12-31T21:00:00.000Z");
  });

  it("rejects malformed and impossible values", () => {
    for (const bad of ["", "2027-03-01", "2027-03-01 09:00", "2027-02-30T10:00", "2027-13-01T10:00", "2027-03-01T24:00", "2027-03-01T10:60", "abc", "2027-02-29T10:00"]) {
      expect(fromTashkentInput(bad)).toBeNull();
    }
  });

  it("formats in Tashkent time regardless of the machine zone", () => {
    expect(formatTashkent(new Date("2027-03-01T20:30:00Z"), "en", true)).toContain("1:30");
    expect(formatTashkent(new Date("2027-03-01T20:30:00Z"), "en", false)).toMatch(/Mar 2, 2027/);
  });
});
