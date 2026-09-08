import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { formatVnd } from "@/lib/format";
import { formatAmountInWords } from "@/lib/money-words";
import { formatFuelLiters } from "@/lib/fuel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("fuel_receipts")
    .select(
      "code, quantity, unit_price, total_amount, invoice_number, notes, created_at, supplier:suppliers(name), fuel_type:fuel_types(name,code,unit), receiver:profiles!fuel_receipts_received_by_fkey(name)"
    )
    .eq("id", id)
    .single();

  if (!r) return new NextResponse("Không tìm thấy phiếu nhập dầu", { status: 404 });

  const total = Number(r.total_amount) || 0;
  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/fuel?tab=receipts`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU NHẬP KHO DẦU & NHIÊN LIỆU"
      code={r.code}
      qrCode={qrCode}
      createdAt={r.created_at}
      fields={[
        { label: "Nhà cung cấp", value: r.supplier?.name ?? "Mua ngoài / Không cố định" },
        { label: "Số hóa đơn / C-từ", value: r.invoice_number ?? "—" },
        { label: "Người nhận / Thủ kho", value: r.receiver?.name ?? "—" },
        { label: "Ghi chú", value: r.notes },
      ]}
      columns={[
        { label: "TÊN NHIÊN LIỆU, DẦU NHỚT", flex: 2.2 },
        { label: "MÃ LOẠI", flex: 1.0 },
        { label: "ĐVT", flex: 0.8, align: "center" },
        { label: "SỐ LƯỢNG", flex: 1.0, align: "right" },
        { label: "ĐƠN GIÁ", flex: 1.2, align: "right" },
        { label: "THÀNH TIỀN", flex: 1.4, align: "right" },
        { label: "GHI CHÚ", flex: 1.0 },
      ]}
      rows={[
        [
          r.fuel_type?.name ?? "Dầu / Nhiên liệu",
          r.fuel_type?.code ?? "—",
          r.fuel_type?.unit ?? "lít",
          formatFuelLiters(Number(r.quantity)),
          formatVnd(Number(r.unit_price)),
          formatVnd(total),
          "",
        ],
      ]}
      totals={[{ left: "TỔNG CỘNG", right: formatVnd(total) }]}
      amountInWords={total > 0 ? `Thành tiền bằng chữ: ${formatAmountInWords(total)}` : undefined}
      signers={["Người giao hàng", "Người nhận (Thủ kho)", "Chủ trại / Quản lý"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.code}.pdf"`,
    },
  });
}
