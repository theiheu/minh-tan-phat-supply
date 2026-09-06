// Xử lý attributes của biến thể (jsonb trong DB) giữa chuỗi JSON và danh sách key–value
// dùng trong form. Mọi hàm thuần — dễ test.
import { variantLabel } from "@/lib/labels";

/** Parse JSON string/object/jsonb/null → object string→string (bỏ giá trị không phải string). */
export function parseAttributesObject(attrs: unknown): Record<string, string> | null {
  if (!attrs) return null;
  let raw: unknown = attrs;
  if (typeof attrs === "string") {
    try {
      raw = JSON.parse(attrs);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Object attributes → cặp [khóa, giá trị] (giữ thứ tự nhập; thêm 1 dòng trống cuối). */
export function attributesToPairs(attrs: unknown): [string, string][] {
  const obj = parseAttributesObject(attrs);
  const pairs = obj ? Object.entries(obj) : [];
  return [...pairs, ["", ""] as [string, string]];
}

/** Cặp [khóa, giá trị] → chuỗi JSON (bỏ dòng trống). */
export function pairsToJson(pairs: [string, string][]): string {
  const obj: Record<string, string> = {};
  for (const [k, v] of pairs) {
    const key = k.trim();
    const value = v.trim();
    if (key && value) obj[key] = value;
  }
  return JSON.stringify(obj);
}

/** Các cặp có đủ khóa + giá trị. */
export function pairsWithoutBlank(pairs: [string, string][]): [string, string][] {
  return pairs.filter(([k, v]) => k.trim() && v.trim());
}

/** Nhãn hiển thị cho bộ: "Bộ (gồm A ×1 · B ×2)" hoặc đơn giản theo label. */
export function kitLabel(label: string, components: { label: string; quantity: number }[]): string {
  if (components.length === 0) return label;
  const parts = components.map((c) => `${c.label} ×${c.quantity}`);
  return `${label} (gồm ${parts.join(" · ")})`;
}

/** Nhãn vật tư/quy cách từ attributes hoặc đơn vị (dùng lại variantLabel). */
export function materialLabel(attributes: unknown, unit?: string | null): string {
  const obj = parseAttributesObject(attributes);
  return variantLabel(obj, unit);
}
