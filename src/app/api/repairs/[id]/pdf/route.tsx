import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { requireManager } from "@/lib/auth";
import { formatDate, formatVnd } from "@/lib/format";
import { REPAIR_OUTCOME, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
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

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU SỬA CHỮA"
      code={r.code}
      date={formatDate(r.created_at)}
      info={[
        ["Đơn vị sửa", r.vendor],
        ["Ngày gửi", formatDate(r.sent_at)],
        ["Dự kiến về", formatDate(r.expected_return_at)],
        ["Tổng chi phí", r.total_cost != null ? formatVnd(r.total_cost) : "—"],
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.6 },
        { label: "Biến thể", flex: 1.4 },
        { label: "Số lượng", flex: 0.8 },
        { label: "Chi tiết sửa", flex: 1.5 },
        { label: "Chi phí", flex: 1.0 },
        { label: "Kết quả", flex: 1.2 },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
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
