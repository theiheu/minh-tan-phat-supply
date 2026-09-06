import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { requireManager } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Bảng tồn kho in PDF theo MỘT kho (controller Task 12): query `location` = uuid kho,
// mặc định KHO_CHINH khi không truyền. View location_stock (0037) là variants-driven
// nên đã gồm cả composite parent (bung linh kiện) — xem 0037_location_stock_variants.sql.
export async function GET(req: Request) {
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const locationParam = new URL(req.url).searchParams.get("location");
  let location: { id: string; code: string; name: string } | null = null;

  if (locationParam) {
    const { data } = await supabase
      .from("stock_locations")
      .select("id, code, name")
      .eq("id", locationParam)
      .maybeSingle();
    location = data;
  } else {
    // Không truyền kho → in Kho chính.
    const { data } = await supabase
      .from("stock_locations")
      .select("id, code, name")
      .eq("code", "KHO_CHINH")
      .maybeSingle();
    location = data;
  }
  if (!location) return new NextResponse("Không tìm thấy kho", { status: 404 });

  // location_stock không có FK tới variants (view không khai FK được) nên PostgREST
  // không cho embed variants(...) — join bằng JS như màn Báo cáo vẫn làm với variant_stock.
  const [{ data: stockRows }, { data: variants }] = await Promise.all([
    supabase
      .from("location_stock")
      .select("variant_id, quantity")
      .eq("location_id", location.id)
      .gt("quantity", 0),
    supabase.from("variants").select("id, attributes, unit, products(name)"),
  ]);

  const variantMap = new Map((variants ?? []).map((v) => [v.id, v]));
  const lines = (stockRows ?? [])
    .map((s) => {
      const v = s.variant_id ? variantMap.get(s.variant_id) : undefined;
      return {
        name: v?.products?.name ?? "—",
        label: v ? variantLabel(v.attributes, v.unit) : "—",
        unit: v?.unit ?? "—",
        quantity: s.quantity ?? 0,
      };
    })
    .sort(
      (a, b) => a.name.localeCompare(b.name, "vi") || a.label.localeCompare(b.label, "vi"),
    );

  const buffer = await renderToBuffer(
    <SlipDocument
      title="BẢNG TỒN KHO"
      createdAt={new Date().toISOString()}
      // Không phải phiếu → không truyền code (engine ẩn "Số phiếu: …"); kho hiện ở dòng fields.
      fields={[{ label: "Kho", value: location.name }]}
      columns={[
        { label: "Tên hàng hoá", flex: 2.6 },
        { label: "Biến thể", flex: 1.4 },
        { label: "ĐVT", flex: 0.6, align: "center" },
        { label: "Tồn kho", flex: 0.9, align: "right" },
      ]}
      rows={lines.map((l) => [l.name, l.label, l.unit, formatNumber(l.quantity)])}
      totals={[{ left: "Tổng số mặt hàng", right: String(lines.length) }]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bang-ton-${location.code}.pdf"`,
    },
  });
}
