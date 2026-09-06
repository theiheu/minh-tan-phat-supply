import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
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
    .select("*, customer:customers!issues_customer_id_fkey(name, phone, address), zone:zones!issues_zone_id_fkey(name), creator:profiles!issues_creator_id_fkey(name)")
    .eq("id", id)
    .single();
  if (!doc) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("issue_items")
    .select("quantity, unit_price, variants(attributes, unit, products(name))")
    .eq("issue_id", id);

  const isSale = doc.destination_type === "customer";
  const total = (items ?? []).reduce((n, i) => n + i.quantity * (i.unit_price ?? 0), 0);
  const totalQty = (items ?? []).reduce((n, i) => n + i.quantity, 0);

  const rightFields: { label: string; value?: string | null }[] = [];
  if (doc.vehicle_plate) rightFields.push({ label: "Biển số xe", value: doc.vehicle_plate });
  if (doc.driver_name) rightFields.push({ label: "Người vận chuyển", value: doc.driver_name });

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU XUẤT KHO"
      code={doc.code}
      createdAt={doc.created_at}
      fields={
        doc.destination_type === "customer"
          ? [
              { label: "Bên nhận hàng", value: doc.customer?.name },
              { label: "Địa chỉ", value: doc.customer?.address },
              { label: "Số điện thoại", value: doc.customer?.phone },
            ]
          : [
              { label: "Nhận tại khu", value: doc.zone?.name },
              { label: "Người lập phiếu", value: doc.creator?.name },
            ]
      }
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
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        i.variants?.unit ?? "—",
        i.quantity,
        ...(isSale ? [formatVnd(i.unit_price ?? 0), formatVnd(i.quantity * (i.unit_price ?? 0))] : []),
        "",
      ])}
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
