import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("stocktake_sessions")
    .select("*, location:stock_locations!stocktake_sessions_location_id_fkey(name, code)")
    .eq("id", id)
    .single();
  if (!session) return new NextResponse("Không tìm thấy phiếu kiểm kê", { status: 404 });

  const { data: items } = await supabase
    .from("stocktake_items")
    .select("system_qty, actual_qty, checked, notes, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol)))")
    .eq("session_id", id)
    .order("sku_id", { ascending: true });

  // Phiếu đã chốt chỉ in các dòng đã kiểm (khớp màn hình); phiếu draft in đủ để cầm đi kiểm.
  const isPosted = session.status === "posted";
  const rows = (items ?? []).filter((i) => !isPosted || i.checked);

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/stocktake`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU KIỂM KÊ"
      code={session.code}
      qrCode={qrCode}
      createdAt={session.created_at}
      fields={[
        { label: "Kho", value: session.location?.name },
        { label: "Ngày kiểm", value: formatDate(session.created_at) },
      ]}
      columns={[
        { label: "TÊN HÀNG HOÁ", flex: 2.0 },
        { label: "BIẾN THỂ", flex: 1.5 },
        { label: "ĐVT", flex: 0.55, align: "center" },
        { label: "TỒN SỔ SÁCH", flex: 0.85, align: "right" },
        { label: "TỒN THỰC TẾ", flex: 0.85, align: "right" },
        { label: "CHÊNH LỆCH", flex: 0.8, align: "right" },
        { label: "GHI CHÚ", flex: 1.4 },
      ]}
      rows={rows.map((i) => {
        const v = i.skus as {
          products?: { name?: string | null } | null;
          units?: { name?: string | null; symbol?: string | null } | null;
          sku_attribute_values?: Array<{
            text_value?: string | null;
            legacy_text_value?: string | null;
            numeric_value?: number | null;
            units?: { symbol?: string | null } | null;
          }> | null;
        } | null;
        const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
        const detail = attrVals.length > 0 ? attrVals.join(" · ") : (v?.units?.symbol || "—");
        return [
          v?.products?.name ?? "—",
          detail,
          v?.units?.symbol || v?.units?.name || "—",
          i.system_qty,
          i.actual_qty,
          i.actual_qty - i.system_qty,
          i.notes ?? "",
        ];
      })}
      signers={["Người kiểm kê", "Thủ kho", "Người duyệt"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${session.code}.pdf"` },
  });
}
