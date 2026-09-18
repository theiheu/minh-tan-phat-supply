import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("defect_notes")
    .select("code, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source:stock_locations!defect_notes_source_location_id_fkey(name)")
    .eq("id", id)
    .single();
  if (!d) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("defect_note_items")
    .select("quantity, entered_quantity, damage_detail, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol)))")
    .eq("defect_note_id", id);

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/defects`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU GHI NHẬN VẬT TƯ HỎNG"
      code={d.code}
      qrCode={qrCode}
      createdAt={d.created_at}
      fields={[
        { label: "Người báo", value: d.reporter?.name },
        { label: "Kho nguồn", value: d.source?.name },
      ]}
      columns={[
        { label: "Mã SKU", flex: 1.0 },
        { label: "Tên vật tư", flex: 1.5 },
        { label: "Quy cách", flex: 1.3 },
        { label: "Đơn vị", flex: 0.7 },
        { label: "Số lượng", flex: 0.8, align: "right" },
        { label: "Chi tiết hỏng", flex: 2.0 },
      ]}
      rows={(items ?? []).map((i) => {
        const v = i.skus as {
          sku_code?: string | null;
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
          v?.sku_code ?? "—",
          v?.products?.name ?? "—",
          detail,
          v?.units?.symbol || v?.units?.name || "—",
          i.entered_quantity ?? i.quantity,
          i.damage_detail ?? "",
        ];
      })}
      signers={["Người báo", "Người xác nhận"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${d.code}.pdf"` },
  });
}
