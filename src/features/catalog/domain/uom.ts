import type { CatalogUnit } from "./types";

export interface TransactionUomDraft {
  unitId: string;
  displayName: string;
  factorToBase: number;
}

export const DEFAULT_CANONICAL_UNITS: CatalogUnit[] = [
  // Đơn vị đếm (count)
  { id: "cai", code: "cai", name: "Cái", symbol: "cái", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "bo", code: "bo", name: "Bộ", symbol: "bộ", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "chiec", code: "chiec", name: "Chiếc", symbol: "chiếc", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "con", code: "con", name: "Con", symbol: "con", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "tam", code: "tam", name: "Tấm", symbol: "tấm", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "cay", code: "cay", name: "Cây", symbol: "cây", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "soi", code: "soi", name: "Sợi", symbol: "sợi", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "ong", code: "ong", name: "Ống", symbol: "ống", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "vien", code: "vien", name: "Viên", symbol: "viên", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "bong", code: "bong", name: "Bóng", symbol: "bóng", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "vong", code: "vong", name: "Vòng", symbol: "vòng", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "doi", code: "doi", name: "Đôi", symbol: "đôi", dimension: "count", factorToReference: 1, decimalScale: 0 },
  { id: "cap", code: "cap", name: "Cặp", symbol: "cặp", dimension: "count", factorToReference: 1, decimalScale: 0 },

  // Đơn vị đóng gói (package)
  { id: "hop", code: "hop", name: "Hộp", symbol: "hộp", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "thung", code: "thung", name: "Thùng", symbol: "thùng", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "bao", code: "bao", name: "Bao", symbol: "bao", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "can", code: "can", name: "Can", symbol: "can", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "chai", code: "chai", name: "Chai", symbol: "chai", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "cuon", code: "cuon", name: "Cuộn", symbol: "cuộn", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "bich", code: "bich", name: "Bịch", symbol: "bịch", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "goi", code: "goi", name: "Gói", symbol: "gói", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "binh", code: "binh", name: "Bình", symbol: "bình", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "phuy", code: "phuy", name: "Phuy", symbol: "phuy", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "xo", code: "xo", name: "Xô", symbol: "xô", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "tuyp", code: "tuyp", name: "Tuýp", symbol: "tuýp", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "vi", code: "vi", name: "Vỉ", symbol: "vỉ", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "kien", code: "kien", name: "Kiện", symbol: "kiện", dimension: "package", factorToReference: 1, decimalScale: 0 },
  { id: "pallet", code: "pallet", name: "Pallet", symbol: "pallet", dimension: "package", factorToReference: 1, decimalScale: 0 },

  // Khối lượng (mass)
  { id: "kg", code: "kg", name: "Kg", symbol: "kg", dimension: "mass", factorToReference: 1, decimalScale: 3 },
  { id: "gam", code: "gam", name: "Gam", symbol: "g", dimension: "mass", factorToReference: 0.001, decimalScale: 2 },
  { id: "tan", code: "tan", name: "Tấn", symbol: "tấn", dimension: "mass", factorToReference: 1000, decimalScale: 3 },
  { id: "ta", code: "ta", name: "Tạ", symbol: "tạ", dimension: "mass", factorToReference: 100, decimalScale: 3 },
  { id: "yen", code: "yen", name: "Yến", symbol: "yến", dimension: "mass", factorToReference: 10, decimalScale: 3 },

  // Chiều dài (length)
  { id: "met", code: "met", name: "Mét", symbol: "m", dimension: "length", factorToReference: 1, decimalScale: 3 },
  { id: "cm", code: "cm", name: "Centimét", symbol: "cm", dimension: "length", factorToReference: 0.01, decimalScale: 2 },
  { id: "mm", code: "mm", name: "Milimét", symbol: "mm", dimension: "length", factorToReference: 0.001, decimalScale: 2 },

  // Thể tích (volume)
  { id: "lit", code: "lit", name: "Lít", symbol: "l", dimension: "volume", factorToReference: 1, decimalScale: 3 },
  { id: "ml", code: "ml", name: "Mililít", symbol: "ml", dimension: "volume", factorToReference: 0.001, decimalScale: 1 },
  { id: "m3", code: "m3", name: "Mét khối", symbol: "m³", dimension: "volume", factorToReference: 1000, decimalScale: 3 },

  // Diện tích (area)
  { id: "m2", code: "m2", name: "Mét vuông", symbol: "m²", dimension: "area", factorToReference: 1, decimalScale: 2 },
];

/**
 * Đơn vị cơ sở là một quyết định nghiệp vụ của người tạo vật tư.
 * Không suy luận từ thứ tự hiển thị của thư viện đơn vị.
 */
export function initialBaseUnitId(): string {
  return "";
}

/** Chỉ hiển thị các đơn vị còn có thể thêm vào bảng quy đổi. */
export function availableTransactionUnits(
  units: CatalogUnit[],
  baseUnitId: string,
  selectedUnitIds: string[],
): CatalogUnit[] {
  const unavailableIds = new Set([baseUnitId, ...selectedUnitIds]);
  return units.filter((unit) => !unavailableIds.has(unit.id));
}

/** Tạo mã ổn định từ đơn vị đã chọn thay vì từ tên hiển thị tự do. */
export function transactionUomCode(unit: CatalogUnit): string {
  return unit.code.trim().toLowerCase();
}

export function validateTransactionUomDraft(
  draft: TransactionUomDraft,
  units: CatalogUnit[],
  baseUnitId: string,
): string | null {
  if (!draft.unitId) return "Vui lòng chọn đơn vị giao dịch";
  if (!units.some((unit) => unit.id === draft.unitId)) return "Đơn vị giao dịch không hợp lệ";
  if (draft.unitId === baseUnitId) return "Đơn vị quy đổi phải khác đơn vị cơ sở";
  if (!draft.displayName.trim()) return "Vui lòng nhập tên hiển thị cho đơn vị giao dịch";
  if (!Number.isFinite(draft.factorToBase) || draft.factorToBase <= 0) {
    return "Hệ số quy đổi phải lớn hơn 0";
  }
  return null;
}

export function validateTransactionUomDrafts(
  drafts: TransactionUomDraft[],
  units: CatalogUnit[],
  baseUnitId: string,
): string | null {
  const usedUnitIds = new Set<string>();
  for (const draft of drafts) {
    const error = validateTransactionUomDraft(draft, units, baseUnitId);
    if (error) return error;
    if (usedUnitIds.has(draft.unitId)) return "Mỗi đơn vị giao dịch chỉ được khai báo một lần";
    usedUnitIds.add(draft.unitId);
  }
  return null;
}
