import { describe, expect, it } from "vitest";
import { productInputSchema, unitConversionInputSchema } from "./schema";

describe("unitConversionInputSchema", () => {
  it("validate hợp lệ với đơn vị cơ sở và đơn vị quy đổi", () => {
    const input = {
      baseUnit: "Hộp",
      baseSpec: "550ml",
      basePrice: 85000,
      baseMinStock: 10,
      baseTrackableLot: false,
      conversions: [
        {
          unit: "Thùng",
          factor: 6,
          price: 480000,
          spec: "1 Thùng = 6 Hộp (550ml)",
        },
      ],
    };

    const parsed = unitConversionInputSchema.parse(input);
    expect(parsed.baseUnit).toBe("Hộp");
    expect(parsed.conversions[0].unit).toBe("Thùng");
    expect(parsed.conversions[0].factor).toBe(6);
  });

  it("bắt lỗi khi không có đơn vị quy đổi", () => {
    const input = {
      baseUnit: "Hộp",
      conversions: [],
    };
    expect(() => unitConversionInputSchema.parse(input)).toThrow();
  });

  it("tích hợp vào productInputSchema khi tạo vật tư quy đổi", () => {
    const payload = {
      name: "Keo dán bạt chuồng trại",
      description: "Keo chuyên dụng dán vá bạt che chuồng kín",
      categoryId: null,
      options: "",
      images: [],
      variants: [
        {
          attributes: JSON.stringify({ "Quy cách": "550ml" }),
          unit: "Hộp",
          price: 85000,
          minStock: 10,
          isTrackableLot: false,
          images: [],
        },
        {
          attributes: JSON.stringify({ "Quy cách": "1 Thùng = 6 Hộp (550ml)" }),
          unit: "Thùng",
          price: 480000,
          minStock: 0,
          isTrackableLot: false,
          images: [],
        },
      ],
      unitConversion: {
        baseUnit: "Hộp",
        baseSpec: "550ml",
        basePrice: 85000,
        baseMinStock: 10,
        baseTrackableLot: false,
        conversions: [
          {
            unit: "Thùng",
            factor: 6,
            price: 480000,
            spec: "1 Thùng = 6 Hộp (550ml)",
          },
        ],
      },
    };

    const parsed = productInputSchema.parse(payload);
    expect(parsed.name).toBe("Keo dán bạt chuồng trại");
    expect(parsed.variants.length).toBe(2);
    expect(parsed.unitConversion?.conversions[0].factor).toBe(6);
  });
});
