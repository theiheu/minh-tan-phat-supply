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

/** Format fuel or liquid quantity with its unit and Vietnamese locale. E.g. 1500 lít → "1.500 lít", 25 can → "25 can" */
export function formatFuelQuantity(quantity: number, unit: string = "lít"): string {
  if (quantity === 0) return `0 ${unit}`;
  const formatted = new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: quantity % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(quantity);
  return `${formatted} ${unit}`;
}

/** Format liters with Vietnamese locale. E.g. 1500 → "1.500 lít", 150.75 → "150,75 lít" */
export function formatFuelLiters(liters: number): string {
  return formatFuelQuantity(liters, "lít");
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

/** Construct a full vehicle scan URL from token or code. */
export function getVehicleQrScanUrl(token: string, origin?: string): string {
  const base = origin ? origin.replace(/\/+$/, "") : "";
  return `${base}/fuel/scan?vehicle=${encodeURIComponent(token)}`;
}

/** Parse QR scan text and determine its type. Supports plain tokens, codes, and full web URLs. */
export function parseQrText(
  text: string
): { type: "vehicle" | "dispense" | "receipt" | "unknown"; value: string } {
  const trimmed = text.trim();
  if (!trimmed) return { type: "unknown", value: "" };

  // Check if text is a URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/")) {
    try {
      const url = new URL(trimmed, "http://localhost");
      
      // Check query parameters
      const vehicleParam =
        url.searchParams.get("vehicle") ||
        url.searchParams.get("token") ||
        url.searchParams.get("vehicleId") ||
        url.searchParams.get("code") ||
        url.searchParams.get("v");
      if (vehicleParam) {
        return parseQrText(vehicleParam);
      }

      const dispenseParam = url.searchParams.get("dispense") || url.searchParams.get("dispenseId");
      if (dispenseParam) {
        return { type: "dispense", value: dispenseParam };
      }

      const receiptParam = url.searchParams.get("receipt") || url.searchParams.get("receiptId");
      if (receiptParam) {
        return { type: "receipt", value: receiptParam };
      }

      // Check pathname segments
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment !== "scan") {
        return parseQrText(decodeURIComponent(lastSegment));
      }
    } catch {
      // If URL parsing fails, proceed with raw string matching below
    }
  }

  if (trimmed.startsWith("VEH_")) return { type: "vehicle", value: trimmed };
  if (trimmed.startsWith("CKD-")) return { type: "dispense", value: trimmed };
  if (trimmed.startsWith("NKD-")) return { type: "receipt", value: trimmed };
  // Treat anything else as a vehicle code/plate for lookup
  return { type: "vehicle", value: trimmed };
}

/** Generate a clean uppercase code slug from a Vietnamese name for fuel/oil types. */
export function generateFuelTypeCode(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toUpperCase();
}

export interface FuelTypePreset {
  name: string;
  code: string;
  unit: string;
  minStock: number;
  description: string;
}

export const FUEL_TYPE_PRESETS: FuelTypePreset[] = [
  {
    name: "Dầu Diesel DO 0.05S-II",
    code: "DIESEL_DO_005",
    unit: "lít",
    minStock: 2000,
    description: "Dầu Diesel chạy xe tải, xe ben, máy xúc, máy phát điện",
  },
  {
    name: "Nhớt động cơ 15W-40",
    code: "NHOT_15W40",
    unit: "lít",
    minStock: 100,
    description: "Nhớt bôi trơn động cơ xe tải, máy đào, máy kéo",
  },
  {
    name: "Dầu thủy lực ISO VG 68",
    code: "DAU_THUY_LUC_68",
    unit: "lít",
    minStock: 200,
    description: "Dầu hệ thống thủy lực, ben nâng, tay gàu xe xúc",
  },
  {
    name: "Nước làm mát động cơ (Coolant)",
    code: "NUOC_LAM_MAT",
    unit: "lít",
    minStock: 50,
    description: "Nước giải nhiệt két nước động cơ xe và máy phát",
  },
  {
    name: "Dầu cầu / Hộp số 80W-90",
    code: "DAU_CAU_HOP_SO_80W90",
    unit: "lít",
    minStock: 50,
    description: "Dầu bôi trơn vi sai cầu sau, hộp số sàn",
  },
  {
    name: "Xăng không chì RON 95-III",
    code: "XANG_RON_95",
    unit: "lít",
    minStock: 100,
    description: "Xăng chạy máy cắt cỏ, máy xịt rửa, xe công vụ",
  },
  {
    name: "Mỡ bôi trơn đa dụng (Grease)",
    code: "MO_BOI_TRON_NLGI2",
    unit: "kg",
    minStock: 20,
    description: "Mỡ bò bôi trơn trục khớp xoay, ổ bi, bạc đạn",
  },
];
