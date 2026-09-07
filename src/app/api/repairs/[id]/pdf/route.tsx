import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { formatDate, formatVnd } from "@/lib/format";
import { REPAIR_OUTCOME, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("repair_orders")
    .select("code, vendor, sent_at, expected_return_at, total_cost, created_at")
    .eq("id", id)
    .single();
  if (!r) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("repair_order_items")
    .select("quantity, repair_detail, cost, outcome, variants(attributes, unit, products(name))")
    .eq("repair_order_id", id);

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/repairs`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU SỬA CHỮA"
      code={r.code}
      qrCode={qrCode}
      createdAt={r.created_at}
      fields={[
        { label: "Đơn vị sửa", value: r.vendor },
        { label: "Ngày gửi", value: formatDate(r.sent_at) },
        { label: "Dự kiến về", value: formatDate(r.expected_return_at) },
        { label: "Tổng chi phí", value: r.total_cost != null ? formatVnd(r.total_cost) : "—" },
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.5 },
        { label: "Biến thể", flex: 1.3 },
        { label: "Đơn vị", flex: 0.6 },
        { label: "Số lượng", flex: 0.7 },
        { label: "Chi tiết sửa", flex: 1.4 },
        { label: "Chi phí", flex: 0.9, align: "right" },
        { label: "Kết quả", flex: 1.1 },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
        i.variants?.unit ?? "—",
        i.quantity,
        i.repair_detail ?? "",
        i.cost != null ? formatVnd(i.cost) : "—",
        i.outcome ? REPAIR_OUTCOME[i.outcome] ?? i.outcome : "",
      ])}
      signers={["Người gửi", "Đơn vị sửa", "Người nhận lại"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.code}.pdf"` },
  });
}
