import { z } from "zod";

export const fuelReceiptSchema = z.object({
  supplierId: z.string().uuid().nullable().optional(),
  fuelTypeId: z.string().uuid("Phải chọn loại dầu"),
  quantity: z.number().positive("Số lượng phải lớn hơn 0"),
  unitPrice: z.number().nonnegative("Đơn giá không được âm").default(0),
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
  vehicleId: z.string().uuid().nullable().optional(),
  zoneId: z.string().uuid().nullable().optional(),
  fuelTypeId: z.string().uuid("Phải chọn loại dầu"),
  quantity: z.number().positive("Số lượng phải lớn hơn 0"),
  currentOdo: z.number().nonnegative("Chỉ số odo không được âm").nullable().optional(),
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
  code: z.string().trim().min(1, "Mã không được trống").max(50),
  name: z.string().trim().min(1, "Tên không được trống").max(200),
  unit: z.string().trim().min(1).default("lít"),
  minStock: z.number().nonnegative().default(0),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type FuelTypeInput = z.infer<typeof fuelTypeSchema>;
