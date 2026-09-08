import { z } from "zod";

export const vehicleSchema = z.object({
  code: z.string().trim().min(1, "Mã xe / Biển số không được trống").max(50),
  name: z.string().trim().min(1, "Tên xe / thiết bị không được trống").max(200),
  type: z
    .enum(["truck", "excavator", "generator", "car", "forklift", "tractor", "other"])
    .default("truck"),
  zoneId: z.string().uuid().nullable().optional(),
  defaultDriver: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
  fuelTypeId: z.string().uuid().nullable().optional(),
  currentOdo: z.number().nonnegative().default(0),
  odoUnit: z.enum(["km", "hours"]).default("km"),
  fuelNorm: z.number().nonnegative().nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  truck: "Xe tải / Xe ben",
  excavator: "Xe xúc / Xe đào",
  generator: "Máy phát điện",
  car: "Xe bán tải / Xe con",
  forklift: "Xe nâng",
  tractor: "Máy cày / Máy kéo",
  other: "Thiết bị khác",
};

export function vehicleTypeLabel(type: string | null | undefined): string {
  if (type && type in VEHICLE_TYPE_LABELS) return VEHICLE_TYPE_LABELS[type];
  return "Khác";
}
