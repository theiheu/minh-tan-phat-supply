import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export async function GET(req: NextRequest) {
  await requireManager();
  const supabase = await createClient();
  const report = req.nextUrl.searchParams.get("report") ?? "stock";

  const { data: variants } = await supabase.from("skus").select(`
    id, sku_code,
    units(name, symbol),
    products(name),
    sku_attribute_values(
      text_value, numeric_value, boolean_value, legacy_text_value,
      attribute_definitions(name),
      units(symbol)
    )
  `);
  const map = new Map((variants ?? []).map((v) => [v.id, v]));
  const label = (id: string | null) => {
    const v = id ? map.get(id) : undefined;
    if (!v) return "—";
    const unitObj = v.units as { name?: string; symbol?: string } | null;
    const unit = unitObj?.symbol || unitObj?.name || "—";
    const attrVals = ((v as unknown as { sku_attribute_values?: Array<{ text_value?: string | null; legacy_text_value?: string | null; numeric_value?: number | null; units?: { symbol?: string | null } | null }> }).sku_attribute_values ?? []).map((av) => {
      return av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null);
    }).filter(Boolean);
    return attrVals.length > 0 ? attrVals.join(" · ") : (unit !== "—" ? unit : "Mặc định");
  };
  const unitOf = (id: string | null) => {
    const v = id ? map.get(id) : undefined;
    const unitObj = v?.units as { name?: string; symbol?: string } | null;
    return unitObj?.symbol || unitObj?.name || "—";
  };

  let rows: Record<string, unknown>[] = [];
  let filename = "report.csv";

  if (report === "stock") {
    const { data } = await supabase.from("sku_stock").select("sku_id, quantity, min_stock").limit(1000);
    rows = (data ?? []).map((r) => ({
      "Vật tư": map.get(r.sku_id ?? "")?.products?.name ?? "—",
      "Biến thể": label(r.sku_id),
      "Đơn vị tính": unitOf(r.sku_id),
      "Tồn": r.quantity ?? 0,
      "Tối thiểu": r.min_stock ?? 0,
    }));
    filename = "ton-kho.csv";
  } else if (report === "movements") {
    const { data } = await supabase
      .from("stock_movements")
      .select("sku_id, movement_type, quantity, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    rows = (data ?? []).map((m) => ({
      "Vật tư": map.get(m.sku_id)?.products?.name ?? "—",
      "Biến thể": label(m.sku_id),
      "Đơn vị tính": unitOf(m.sku_id),
      "Loại": m.movement_type,
      "Số lượng": m.quantity,
      "Thời gian": m.created_at,
    }));
    filename = "bien-dong-kho.csv";
  }

  return new NextResponse("\uFEFF" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
