import { describe, it, expect } from "vitest";
import { vehicleSchema, vehicleTypeLabel, VEHICLE_TYPE_LABELS } from "./schema";

describe("vehicleSchema", () => {
  it("validates and parses valid vehicle input including documentImages", () => {
    const input = {
      code: "61C-123.45",
      name: "Xe tải Howo 4 chân",
      type: "truck",
      currentOdo: 12500.5,
      odoUnit: "km",
      fuelNorm: 35.5,
      notes: "Xe phục vụ vận chuyển vật tư trại",
      documentImages: [
        "https://example.com/cavet.jpg",
        "https://example.com/dangkiem.jpg",
      ],
    };

    const parsed = vehicleSchema.parse(input);
    expect(parsed.code).toBe("61C-123.45");
    expect(parsed.name).toBe("Xe tải Howo 4 chân");
    expect(parsed.type).toBe("truck");
    expect(parsed.currentOdo).toBe(12500.5);
    expect(parsed.odoUnit).toBe("km");
    expect(parsed.fuelNorm).toBe(35.5);
    expect(parsed.documentImages).toEqual([
      "https://example.com/cavet.jpg",
      "https://example.com/dangkiem.jpg",
    ]);
  });

  it("defaults documentImages to empty array if omitted", () => {
    const input = {
      code: "MAY-XUC-01",
      name: "Xe cuốc Komatsu PC200",
      type: "excavator",
    };

    const parsed = vehicleSchema.parse(input);
    expect(parsed.documentImages).toEqual([]);
    expect(parsed.currentOdo).toBe(0);
    expect(parsed.odoUnit).toBe("km");
  });

  it("throws when code or name is missing", () => {
    expect(() => vehicleSchema.parse({ code: "", name: "Xe 1" })).toThrow();
    expect(() => vehicleSchema.parse({ code: "61C-111.11", name: "" })).toThrow();
  });
});

describe("vehicleTypeLabel helper", () => {
  it("returns correct Vietnamese label for vehicle types", () => {
    expect(vehicleTypeLabel("truck")).toBe(VEHICLE_TYPE_LABELS.truck);
    expect(vehicleTypeLabel("excavator")).toBe(VEHICLE_TYPE_LABELS.excavator);
    expect(vehicleTypeLabel("generator")).toBe(VEHICLE_TYPE_LABELS.generator);
    expect(vehicleTypeLabel("unknown_type" as any)).toBe("Khác");
  });
});
