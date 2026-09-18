import type { VariantWithStock } from "../types";

export function parseVariantHierarchy(
  v: Omit<VariantWithStock, 'parsedHierarchy'>,
  definedOptions: string[]
): { levels: Record<string, string>; fullLabel: string; brandOrGroup: string; specLabel: string } {
  // 1. Nếu vật tư đã khai báo options rõ ràng
  if (definedOptions.length > 0 && v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) {
    const attrs = v.attributes as Record<string, string>;
    const res: Record<string, string> = {};
    for (const opt of definedOptions) {
      if (attrs[opt] && typeof attrs[opt] === "string" && attrs[opt].trim()) {
        res[opt] = attrs[opt].trim();
      }
    }
    if (Object.keys(res).length >= 1) {
      const keys = definedOptions.filter((k) => res[k]);
      const brandOrGroup = res[keys[0]] || "";
      const restKeys = keys.slice(1);
      const specLabel = restKeys.length > 0 ? restKeys.map((k) => res[k]).join(" · ") : res[keys[0]];
      const fullLabel = keys.map((k) => res[k]).join(" · ");
      return { levels: res, fullLabel, brandOrGroup, specLabel };
    }
  }

  // 2. Nếu attributes có nhiều khóa (VD: { "Hãng": "SKF", "Mã": "6203", "Nắp": "2RS" })
  if (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes)) {
    const attrs = v.attributes as Record<string, string>;
    const keys = Object.keys(attrs).filter((k) => attrs[k] && typeof attrs[k] === "string" && attrs[k].trim());
    if (keys.length >= 2) {
      const res: Record<string, string> = {};
      for (const k of keys) {
        res[k] = attrs[k].trim();
      }
      const brandOrGroup = res[keys[0]] || "";
      const specLabel = keys.slice(1).map((k) => res[k]).join(" · ");
      const fullLabel = keys.map((k) => res[k]).join(" · ");
      return { levels: res, fullLabel, brandOrGroup, specLabel };
    }
  }

  // 3. Nếu là chuỗi phẳng (VD: "SKF 6203 2RS", "Koyo - 6203 ZZ", "Phi 21 - Dày 1.2mm")
  const rawLabel =
    (v.attributes && typeof v.attributes === "object" && !Array.isArray(v.attributes) && Object.values(v.attributes)[0]) ||
    v.sku_code ||
    v.unit ||
    "";
  const str = String(rawLabel).trim();

  // Tách theo dấu phân cách chuẩn
  let parts = str.split(/\s*·\s*|\s*-\s*|\s*\/\s*/).filter(Boolean);
  if (parts.length === 1) {
    parts = str.split(/\s+/).filter(Boolean);
  }

  if (parts.length >= 2) {
    const res: Record<string, string> = {};
    const brandOrGroup = parts[0];
    const specLabel = parts.slice(1).join(" · ");
    res["Hãng / Phân nhóm"] = brandOrGroup;
    res["Mã / Kích thước"] = parts[1];
    if (parts.length >= 3) {
      res["Loại / Chi tiết"] = parts.slice(2).join(" ");
    }
    return { levels: res, fullLabel: parts.join(" · "), brandOrGroup, specLabel };
  }

  const defaultVal = str || v.unit || "Mặc định";
  return {
    levels: { "Quy cách": defaultVal },
    fullLabel: defaultVal,
    brandOrGroup: "",
    specLabel: defaultVal,
  };
}
