import type { CatalogUnit } from "./types";

export interface TransactionUomDraft {
  unitId: string;
  displayName: string;
  factorToBase: number;
}

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
