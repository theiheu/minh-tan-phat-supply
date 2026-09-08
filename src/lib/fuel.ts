/**
 * Core fuel domain calculations and utilities.
 * All number formatting follows Vietnamese locale conventions.
 */

/** Calculate the difference between current and previous odometer readings. */
export function calcUsageDiff(
  current: number,
  previous?: number | null
): number {
  if (previous == null || current <= previous) return 0;
  return current - previous;
}

/** 
 * Calculate consumption rate.
 * For km: returns L/100km. For hours: returns L/h.
 * Returns null if usageDiff <= 0.
 */
export function calcConsumptionRate(
  quantity: number,
  usageDiff: number,
  unit: "km" | "hours"
): number | null {
  if (usageDiff <= 0) return null;
  if (unit === "km") return Math.round((quantity / usageDiff) * 100 * 100) / 100;
  return Math.round((quantity / usageDiff) * 100) / 100;
}

/** Format liters with Vietnamese locale. E.g. 1500 → "1.500 lít", 150.75 → "150,75 lít" */
export function formatFuelLiters(liters: number): string {
  if (liters === 0) return "0 lít";
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: liters % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(liters);
  return `${formatted} lít`;
}

/** Format odometer or hour meter value. E.g. 12780 km → "12.780 km", 3450.5 hours → "3.450,5 giờ" */
export function formatOdo(odo: number, unit: "km" | "hours"): string {
  const suffix = unit === "km" ? "km" : "giờ";
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: odo % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(odo);
  return `${formatted} ${suffix}`;
}

/** Format consumption rate. E.g. 45.45 km → "45,45 L/100km", 15 hours → "15 L/giờ" */
export function formatConsumptionRate(
  rate: number | null,
  unit: "km" | "hours"
): string {
  if (rate == null) return "—";
  const suffix = unit === "km" ? "L/100km" : "L/giờ";
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: rate % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rate);
  return `${formatted} ${suffix}`;
}

/** Generate a deterministic QR token from a vehicle code. */
export function generateVehicleQrToken(code: string): string {
  const sanitized = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VEH_${sanitized}_${suffix}`;
}

/** Parse QR scan text and determine its type. */
export function parseQrText(
  text: string
): { type: "vehicle" | "dispense" | "receipt" | "unknown"; value: string } {
  const trimmed = text.trim();
  if (!trimmed) return { type: "unknown", value: "" };
  if (trimmed.startsWith("VEH_")) return { type: "vehicle", value: trimmed };
  if (trimmed.startsWith("CKD-")) return { type: "dispense", value: trimmed };
  if (trimmed.startsWith("NKD-")) return { type: "receipt", value: trimmed };
  // Treat anything else as a vehicle code/plate for lookup
  return { type: "vehicle", value: trimmed };
}
