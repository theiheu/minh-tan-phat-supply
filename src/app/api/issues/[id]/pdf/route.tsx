import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { formatZoneLabel } from "@/lib/format-zone";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { formatVnd } from "@/lib/format";
import { formatAmountInWords } from "@/lib/money-words";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("issues")
    .select("*, customer:customers!issues_customer_id_fkey(name, phone, address), zone:zones!issues_zone_id_fkey(name), sub_zone:sub_zones!issues_sub_zone_id_fkey(name), creator:profiles!issues_creator_id_fkey(name)")
    .eq("id", id)
    .single();
  if (!doc) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("issue_items")
    .select("quantity, entered_quantity, unit_price, sku_name_snapshot, uom_name_snapshot, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol)))")
    .eq("issue_id", id);

  const isSale = doc.destination_type === "customer";
  const total = (items ?? []).reduce((n, i) => n + (i.entered_quantity ?? i.quantity) * (i.unit_price ?? 0), 0);
  const totalQty = (items ?? []).reduce((n, i) => n + (i.entered_quantity ?? i.quantity), 0);

  const destFields: { label: string; value?: string | null }[] =
    doc.destination_type === "customer"
      ? [
          { label: "Bên nhận hàng", value: doc.customer?.name },
          { label: "Địa chỉ", value: doc.customer?.address },
          { label: "Số điện thoại", value: doc.customer?.phone },
        ]
      : [
          { label: "Nhận tại khu", value: formatZoneLabel(doc.zone?.name, doc.sub_zone?.name) },
          { label: "Người lập phiếu", value: doc.creator?.name },
        ];
  // Ghi chú phiếu (issues.notes) — chỉ in khi có nội dung; cột GHI CHÚ trong bảng
  // vẫn giữ (theo mẫu giấy) nhưng để trống cho người ký tay.
  if (doc.notes) destFields.push({ label: "Ghi chú", value: doc.notes });

  const rightFields: { label: string; value?: string | null }[] = [];
  if (doc.vehicle_plate) rightFields.push({ label: "Biển số xe", value: doc.vehicle_plate });
  if (doc.driver_name) rightFields.push({ label: "Người vận chuyển", value: doc.driver_name });

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/issues/${id}`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU XUẤT KHO"
      code={doc.code}
      qrCode={qrCode}
      createdAt={doc.created_at}
      fields={destFields}
      rightPanel={rightFields.length > 0 ? { heading: "Thông tin xe vận chuyển", fields: rightFields } : undefined}
      columns={
        isSale
          ? [
              { label: "TÊN SẢN PHẨM, HÀNG HÓA", flex: 2.4 },
              { label: "ĐVT", flex: 0.6, align: "center" },
              { label: "SL", flex: 0.6, align: "right" },
              { label: "ĐƠN GIÁ", flex: 1.0, align: "right" },
              { label: "THÀNH TIỀN", flex: 1.1, align: "right" },
              { label: "GHI CHÚ", flex: 0.9 },
            ]
          : [
              { label: "TÊN SẢN PHẨM, HÀNG HÓA", flex: 3.0 },
              { label: "ĐVT", flex: 0.8, align: "center" },
              { label: "SL", flex: 0.8, align: "right" },
              { label: "GHI CHÚ", flex: 1.2 },
            ]
      }
      rows={(items ?? []).map((i) => {
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
        const baseName = i.sku_name_snapshot || v?.products?.name || "—";
        const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
        const detail = attrVals.length > 0 ? attrVals.join(" · ") : null;
        const fullName = detail && detail !== "—" && !baseName.includes(detail) ? `${baseName} - ${detail}` : baseName;
        const unit = i.uom_name_snapshot || v?.units?.symbol || v?.units?.name || "—";
        const qty = i.entered_quantity ?? i.quantity;
        return [
          fullName,
          unit,
          qty,
          ...(isSale ? [formatVnd(i.unit_price ?? 0), formatVnd(qty * (i.unit_price ?? 0))] : []),
          "",
        ];
      })}
      totals={isSale ? [{ left: "TỔNG CỘNG", right: formatVnd(total) }] : [{ left: "TỔNG CỘNG", right: `Tổng số lượng: ${totalQty}` }]}
      amountInWords={isSale ? `Thành tiền bằng chữ: ${formatAmountInWords(total)}` : undefined}
      signers={
        doc.destination_type === "customer"
          ? ["Người nhận hàng", "Vận chuyển", "Người lập phiếu (Đại diện người bán)", "Chủ trại"]
          : ["Người nhận hàng", "Người lập phiếu", "Chủ trại"]
      }
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.code}.pdf"` },
  });
}
