import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { requireManager } from "@/lib/auth";
import { formatDate, formatVnd } from "@/lib/format";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("receipts")
    .select("code, notes, created_at, supplier:suppliers(name), creator:profiles(name)")
    .eq("id", id)
    .single();
  if (!r) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("receipt_items")
    .select("quantity, unit_cost, batch_no, expiry_date, variants(attributes, unit, products(name))")
    .eq("receipt_id", id);

  const total = (items ?? []).reduce((n, i) => n + i.quantity * (i.unit_cost ?? 0), 0);

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU NHẬP KHO"
      code={r.code}
      date={formatDate(r.created_at)}
      info={[
        ["Nhà cung cấp", r.supplier?.name ?? ""],
        ["Người lập", r.creator?.name ?? ""],
        ["Ghi chú", r.notes ?? ""],
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.5 },
        { label: "Biến thể", flex: 1.3 },
        { label: "Đơn vị", flex: 0.7 },
        { label: "Số lượng", flex: 0.8 },
        { label: "Đơn giá", flex: 1.0 },
        { label: "Thành tiền", flex: 1.0 },
        { label: "Lô", flex: 0.8 },
        { label: "Hạn sử dụng", flex: 0.9 },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
        i.variants?.unit ?? "—",
        i.quantity,
        i.unit_cost != null ? formatVnd(i.unit_cost) : "—",
        formatVnd(i.quantity * (i.unit_cost ?? 0)),
        i.batch_no ?? "",
        i.expiry_date ? formatDate(i.expiry_date) : "",
      ])}
      signers={["Người lập", "Thủ kho", "Người duyệt"]}
      totalNote={`Tổng tiền: ${formatVnd(total)}`}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.code}.pdf"` },
  });
}
