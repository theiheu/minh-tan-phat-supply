import { describe, it, expect } from "vitest";
import { fuelDispenseSchema, fuelTypeSchema, fuelTypeUpdateSchema } from "./schema";

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

describe("fuelDispenseSchema", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("parses vehicle dispense correctly with default dispenseType", () => {
    const input = {
      vehicleId: validUuid,
      fuelTypeId: validUuid,
      quantity: "150.5",
      currentOdo: "12500.5",
      driverName: "Nguyễn Văn A",
    };
    const parsed = fuelDispenseSchema.parse(input);
    expect(parsed.dispenseType).toBe("vehicle");
    expect(parsed.quantity).toBe(150.5);
    expect(parsed.currentOdo).toBe(12500.5);
    expect(parsed.vehicleId).toBe(validUuid);
  });

  it("parses zone dispense correctly when dispenseType is zone", () => {
    const input = {
      vehicleId: validUuid,
      zoneId: validUuid,
      subZoneId: validUuid,
      dispenseType: "zone",
      fuelTypeId: validUuid,
      quantity: "500",
      notes: "Cấp dầu dự phòng cho máy phát điện trại 1",
    };
    const parsed = fuelDispenseSchema.parse(input);
    expect(parsed.dispenseType).toBe("zone");
    expect(parsed.quantity).toBe(500);
    expect(parsed.vehicleId).toBe(validUuid);
    expect(parsed.zoneId).toBe(validUuid);
    expect(parsed.currentOdo).toBeUndefined();
  });
});
