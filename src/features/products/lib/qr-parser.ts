const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ParsedProductQr {
  type: "sku_id" | "search_query";
  value: string;
}

export function parseProductQrText(raw: string): ParsedProductQr {
  const trimmed = (raw || "").trim();
  if (!trimmed) return { type: "search_query", value: "" };

  // 1. Direct UUID
  if (UUID_REGEX.test(trimmed)) {
    return { type: "sku_id", value: trimmed.toLowerCase() };
  }

  // 2. MTP format: MTP:VAR:<uuid> or MTP:PROD:<uuid>
  if (trimmed.toUpperCase().startsWith("MTP:VAR:")) {
    const candidate = trimmed.substring(8).trim();
    if (UUID_REGEX.test(candidate)) {
      return { type: "sku_id", value: candidate.toLowerCase() };
    }
  }

  // 3. URL format: .../products?variant=<uuid> or .../qr/variant/<uuid>
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const variantParam = url.searchParams.get("variant") || url.searchParams.get("sku_id") || url.searchParams.get("v");
    if (variantParam && UUID_REGEX.test(variantParam)) {
      return { type: "sku_id", value: variantParam.toLowerCase() };
    }

    const pathSegments = url.pathname.split("/").filter(Boolean);
    const lastSeg = pathSegments[pathSegments.length - 1];
    if (lastSeg && UUID_REGEX.test(lastSeg)) {
      return { type: "sku_id", value: lastSeg.toLowerCase() };
    }
  } catch {
    // Not a valid URL, fallback to search query
  }

  return { type: "search_query", value: trimmed };
}
