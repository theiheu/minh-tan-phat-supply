import { describe, it, expect } from "vitest";
import {
  calcUsageDiff,
  calcConsumptionRate,
  formatFuelLiters,
  formatOdo,
  formatConsumptionRate,
  generateVehicleQrToken,
  getVehicleQrScanUrl,
  parseQrText,
} from "./fuel";

describe("calcUsageDiff", () => {
  it("returns difference when current > previous", () => {
    expect(calcUsageDiff(12780, 12450)).toBe(330);
  });
  it("returns 0 when previous is null", () => {
    expect(calcUsageDiff(12780, null)).toBe(0);
  });
  it("returns 0 when previous is undefined", () => {
    expect(calcUsageDiff(12780, undefined)).toBe(0);
  });
  it("returns 0 when current equals previous", () => {
    expect(calcUsageDiff(100, 100)).toBe(0);
  });
  it("returns 0 when current < previous (anomaly)", () => {
    expect(calcUsageDiff(50, 100)).toBe(0);
  });
  it("handles decimal values", () => {
    expect(calcUsageDiff(3450.5, 3400.0)).toBeCloseTo(50.5);
  });
});

describe("calcConsumptionRate", () => {
  it("calculates L/100km correctly", () => {
    // 150 liters over 330 km = 45.45 L/100km
    expect(calcConsumptionRate(150, 330, "km")).toBeCloseTo(45.45, 1);
  });
  it("calculates L/hour correctly", () => {
    // 45 liters over 3 hours = 15 L/h
    expect(calcConsumptionRate(45, 3, "hours")).toBe(15);
  });
  it("returns null when usage diff is 0", () => {
    expect(calcConsumptionRate(150, 0, "km")).toBeNull();
  });
  it("returns null when usage diff is negative", () => {
    expect(calcConsumptionRate(150, -10, "km")).toBeNull();
  });
});

describe("formatFuelLiters", () => {
  it("formats integer liters", () => {
    expect(formatFuelLiters(1500)).toBe("1.500 lít");
  });
  it("formats decimal liters", () => {
    expect(formatFuelLiters(150.75)).toBe("150,75 lít");
  });
  it("formats 0", () => {
    expect(formatFuelLiters(0)).toBe("0 lít");
  });
});

describe("formatOdo", () => {
  it("formats km", () => {
    expect(formatOdo(12780, "km")).toBe("12.780 km");
  });
  it("formats hours", () => {
    expect(formatOdo(3450.5, "hours")).toBe("3.450,5 giờ");
  });
});

describe("formatConsumptionRate", () => {
  it("formats km rate", () => {
    expect(formatConsumptionRate(45.45, "km")).toBe("45,45 L/100km");
  });
  it("formats hours rate", () => {
    expect(formatConsumptionRate(15, "hours")).toBe("15 L/giờ");
  });
  it("returns dash for null", () => {
    expect(formatConsumptionRate(null, "km")).toBe("—");
  });
});

describe("generateVehicleQrToken", () => {
  it("generates a deterministic token from vehicle code", () => {
    const token = generateVehicleQrToken("61C-123.45");
    expect(token).toMatch(/^VEH_/);
    expect(token.length).toBeGreaterThan(10);
  });
  it("strips non-alphanumeric from code", () => {
    const token = generateVehicleQrToken("61C-123.45");
    // Should not contain dots or dashes in the generated part
    expect(token).toMatch(/^VEH_[A-Z0-9_]+$/);
  });
});

describe("getVehicleQrScanUrl", () => {
  it("builds absolute scan url when origin is provided", () => {
    expect(getVehicleQrScanUrl("VEH_61C12345_A8B9", "https://app.example.com")).toBe(
      "https://app.example.com/fuel/scan?vehicle=VEH_61C12345_A8B9"
    );
  });
  it("builds relative scan url when origin is omitted", () => {
    expect(getVehicleQrScanUrl("61C-123.45")).toBe(
      "/fuel/scan?vehicle=61C-123.45"
    );
  });
});

describe("parseQrText", () => {
  it("detects vehicle QR token", () => {
    const result = parseQrText("VEH_61C12345_HOWO");
    expect(result).toEqual({ type: "vehicle", value: "VEH_61C12345_HOWO" });
  });
  it("detects fuel dispense code", () => {
    const result = parseQrText("CKD-0001");
    expect(result).toEqual({ type: "dispense", value: "CKD-0001" });
  });
  it("detects fuel receipt code", () => {
    const result = parseQrText("NKD-0002");
    expect(result).toEqual({ type: "receipt", value: "NKD-0002" });
  });
  it("treats plain text as vehicle code/plate lookup", () => {
    const result = parseQrText("61C-123.45");
    expect(result).toEqual({ type: "vehicle", value: "61C-123.45" });
  });
  it("extracts vehicle token from full scan URL with ?vehicle= param", () => {
    const result = parseQrText("https://minh-tan-phat.vn/fuel/scan?vehicle=VEH_61C12345_HOWO");
    expect(result).toEqual({ type: "vehicle", value: "VEH_61C12345_HOWO" });
  });
  it("extracts vehicle token from scan URL with ?token= param", () => {
    const result = parseQrText("https://minh-tan-phat.vn/fuel/scan?token=VEH_61C12345_HOWO");
    expect(result).toEqual({ type: "vehicle", value: "VEH_61C12345_HOWO" });
  });
  it("extracts vehicle code from scan URL with ?code= param", () => {
    const result = parseQrText("http://localhost:3000/fuel/scan?code=61C-123.45");
    expect(result).toEqual({ type: "vehicle", value: "61C-123.45" });
  });
  it("extracts vehicle from path URL", () => {
    const result = parseQrText("https://minh-tan-phat.vn/qr/vehicle/VEH_61C12345_HOWO");
    expect(result).toEqual({ type: "vehicle", value: "VEH_61C12345_HOWO" });
  });
  it("returns unknown for empty string", () => {
    const result = parseQrText("");
    expect(result).toEqual({ type: "unknown", value: "" });
  });
});
