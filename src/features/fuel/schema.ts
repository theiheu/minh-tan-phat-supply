import { z } from "zod";

const positiveNumber2Decimals = z.coerce
  .number()
  .positive("Số lượng phải lớn hơn 0")
  .refine((val) => Number.isFinite(val), "Số không hợp lệ")
  .transform((val) => Math.round(val * 100) / 100);

const nonNegativeNumber2Decimals = z.coerce
  .number()
  .nonnegative("Giá trị không được âm")
  .refine((val) => Number.isFinite(val), "Số không hợp lệ")
  .transform((val) => Math.round(val * 100) / 100);

export const fuelReceiptSchema = z.object({
  supplierId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "" && v !== "none" ? v : null)),
  fuelTypeId: z.string().uuid("Phải chọn loại dầu"),
  quantity: positiveNumber2Decimals,
  unitPrice: nonNegativeNumber2Decimals.default(0),
  invoiceNumber: z
    .string()
    .trim()
    .max(100, "Tối đa 100 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
  invoiceImages: z.array(z.string()).optional().default([]),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type FuelReceiptInput = z.infer<typeof fuelReceiptSchema>;

export const fuelDispenseSchema = z.object({
  vehicleId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "" && v !== "none" ? v : null)),
  zoneId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "" && v !== "none" ? v : null)),
  subZoneId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "" && v !== "none" ? v : null)),
  dispenseType: z.enum(["vehicle", "zone"]).default("vehicle"),
  fuelTypeId: z.string().uuid("Phải chọn loại dầu"),
  quantity: positiveNumber2Decimals,
  currentOdo: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    nonNegativeNumber2Decimals.nullable().optional()
  ),
  driverId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v !== "" && v !== "none" ? v : null)),
  driverName: z
    .string()
    .trim()
    .max(100, "Tối đa 100 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
  meterImages: z.array(z.string()).optional().default([]),
  notes: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type FuelDispenseInput = z.infer<typeof fuelDispenseSchema>;

export const fuelTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã phân loại không được trống")
    .max(50, "Mã phân loại tối đa 50 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, "Tên loại nhiên liệu/dầu không được trống").max(200, "Tên tối đa 200 ký tự"),
  unit: z.string().trim().min(1, "Đơn vị tính không được trống").default("lít"),
  minStock: nonNegativeNumber2Decimals.default(0),
  initialStock: nonNegativeNumber2Decimals.optional().default(0),
  description: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type FuelTypeInput = z.input<typeof fuelTypeSchema>;

export const fuelTypeUpdateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã phân loại không được trống")
    .max(50, "Mã phân loại tối đa 50 ký tự")
    .regex(/^[A-Za-z0-9_-]+$/, "Mã chỉ được chứa chữ cái, số, dấu gạch ngang hoặc gạch dưới")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(1, "Tên loại nhiên liệu/dầu không được trống").max(200, "Tên tối đa 200 ký tự"),
  unit: z.string().trim().min(1, "Đơn vị tính không được trống").default("lít"),
  minStock: nonNegativeNumber2Decimals.default(0),
  description: z
    .string()
    .trim()
    .max(500, "Ghi chú tối đa 500 ký tự")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type FuelTypeUpdateInput = z.input<typeof fuelTypeUpdateSchema>;
