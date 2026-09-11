import { describe, expect, it } from "vitest";
import { formatZoneLabel } from "./format-zone";

describe("formatZoneLabel", () => {
  it("formats zone and subZone as 'Zone - SubZone'", () => {
    expect(formatZoneLabel("Khu 1", "Trại 1")).toBe("Khu 1 - Trại 1");
    expect(formatZoneLabel({ name: "Khu 4" }, { name: "Xưởng phân" })).toBe("Khu 4 - Xưởng phân");
    expect(formatZoneLabel("Khu 2", { name: "Trại 5" })).toBe("Khu 2 - Trại 5");
  });

  it("formats only zone when subZone is missing or null", () => {
    expect(formatZoneLabel("Khu 1", null)).toBe("Khu 1");
    expect(formatZoneLabel({ name: "Khu 1" }, undefined)).toBe("Khu 1");
    expect(formatZoneLabel("Khu 3", "")).toBe("Khu 3");
  });

  it("returns subZone if zone is missing", () => {
    expect(formatZoneLabel(null, "Trại 2")).toBe("Trại 2");
    expect(formatZoneLabel(undefined, { name: "Xưởng cơ điện" })).toBe("Xưởng cơ điện");
  });

  it("returns fallback when both are null or empty", () => {
    expect(formatZoneLabel(null, null)).toBe("—");
    expect(formatZoneLabel("", "", "Chưa phân khu")).toBe("Chưa phân khu");
  });
});
