import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { formatDate, formatVnd } from "@/lib/format";
import { formatAmountInWords } from "@/lib/money-words";
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
    .select("code, notes, created_at, supplier:suppliers(name), creator:profiles!receipts_created_by_fkey(name), approver:profiles!receipts_approved_by_fkey(name)")
    .eq("id", id)
    .single();
  if (!r) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("receipt_items")
    .select("quantity, unit_cost, batch_no, expiry_date, variants(attributes, unit, products(name))")
    .eq("receipt_id", id);

  const total = (items ?? []).reduce((n, i) => n + i.quantity * (i.unit_cost ?? 0), 0);
  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/receipts/${id}`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU ĐẶT HÀNG & NHẬP KHO"
      code={r.code}
      qrCode={qrCode}
      createdAt={r.created_at}
      fields={[
        { label: "Nhà cung cấp", value: r.supplier?.name },
        { label: "Người lập", value: r.creator?.name },
        { label: "Người duyệt", value: r.approver?.name },
        { label: "Ghi chú", value: r.notes },
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.5 },
        { label: "Biến thể", flex: 1.3 },
        { label: "Đơn vị", flex: 0.7 },
        { label: "Số lượng", flex: 0.8, align: "right" },
        { label: "Đơn giá", flex: 1.0, align: "right" },
        { label: "Thành tiền", flex: 1.0, align: "right" },
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
      totals={[{ left: "TỔNG CỘNG", right: formatVnd(total) }]}
      amountInWords={`Thành tiền bằng chữ: ${formatAmountInWords(total)}`}
      signers={["Người lập", "Thủ kho", "Người duyệt"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.code}.pdf"` },
  });
}
