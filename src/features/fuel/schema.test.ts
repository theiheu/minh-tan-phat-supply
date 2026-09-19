import { describe, it, expect } from "vitest";
import { fuelTypeSchema, fuelTypeUpdateSchema } from "./schema";

describe("fuelTypeSchema", () => {
  it("validates and parses valid fuel type input", () => {
    const input = {
      name: "Dầu Diesel DO 0.05S",
      code: "DIESEL_DO_005",
      unit: "lít",
      minStock: "500",
      initialStock: "1000",
      description: "Dầu diesel tiêu chuẩn cho xe tải",
    };

    const parsed = fuelTypeSchema.parse(input);
    expect(parsed.name).toBe("Dầu Diesel DO 0.05S");
    expect(parsed.code).toBe("DIESEL_DO_005");
    expect(parsed.unit).toBe("lít");
    expect(parsed.minStock).toBe(500);
    expect(parsed.initialStock).toBe(1000);
    expect(parsed.description).toBe("Dầu diesel tiêu chuẩn cho xe tải");
  });

  it("converts lowercase code to uppercase", () => {
    const input = {
      name: "Nhớt 15W40",
      code: "nhot_15w40",
      unit: "can",
    };
    const parsed = fuelTypeSchema.parse(input);
    expect(parsed.code).toBe("NHOT_15W40");
    expect(parsed.unit).toBe("can");
    expect(parsed.minStock).toBe(0);
    expect(parsed.initialStock).toBe(0);
  });

  it("throws when code contains invalid characters like spaces", () => {
    const input = {
      name: "Nhớt 15W40",
      code: "NHOT 15W40",
    };
    expect(() => fuelTypeSchema.parse(input)).toThrow();
  });

  it("throws when name is empty", () => {
    const input = {
      name: "   ",
      code: "NHOT_15W40",
    };
    expect(() => fuelTypeSchema.parse(input)).toThrow();
  });
});

describe("fuelTypeUpdateSchema", () => {
  it("validates update input without initialStock", () => {
    const input = {
      name: "Nước làm mát Coolant",
      code: "NUOC_MAT",
      unit: "lít",
      minStock: "20",
      description: "Nước làm mát màu xanh",
    };
    const parsed = fuelTypeUpdateSchema.parse(input);
    expect(parsed.name).toBe("Nước làm mát Coolant");
    expect(parsed.code).toBe("NUOC_MAT");
    expect(parsed.minStock).toBe(20);
  });
});
