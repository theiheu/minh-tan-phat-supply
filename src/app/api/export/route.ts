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

  const { data: variants } = await supabase.from("variants").select("id, attributes, unit, products(name)");
  const map = new Map((variants ?? []).map((v) => [v.id, v]));
  const label = (id: string | null) => {
    const v = id ? map.get(id) : undefined;
    return v ? variantLabel(v.attributes, v.unit) : "—";
  };

  let rows: Record<string, unknown>[] = [];
  let filename = "report.csv";

  if (report === "stock") {
    const { data } = await supabase.from("variant_stock").select("variant_id, quantity, min_stock").limit(1000);
    rows = (data ?? []).map((r) => ({
      "Vật tư": map.get(r.variant_id ?? "")?.products?.name ?? "—",
      "Biến thể": label(r.variant_id),
      "Tồn": r.quantity ?? 0,
      "Tối thiểu": r.min_stock ?? 0,
    }));
    filename = "ton-kho.csv";
  } else if (report === "movements") {
    const { data } = await supabase
      .from("stock_movements")
      .select("variant_id, movement_type, quantity, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    rows = (data ?? []).map((m) => ({
      "Vật tư": map.get(m.variant_id)?.products?.name ?? "—",
      "Biến thể": label(m.variant_id),
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
