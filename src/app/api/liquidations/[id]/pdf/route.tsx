import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { formatVnd } from "@/lib/format";
import { LIQUIDATION_METHOD, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: l } = await supabase
    .from("liquidation_notes")
    .select(
      "code, reason, created_at, creator:profiles!liquidation_notes_created_by_fkey(name), approver:profiles!liquidation_notes_approved_by_fkey(name)",
    )
    .eq("id", id)
    .single();
  if (!l) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("liquidation_items")
    .select("quantity, method, unit_value, proceeds, variants(attributes, unit, products(name))")
    .eq("liquidation_note_id", id);

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/liquidations`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU THANH LÝ"
      code={l.code}
      qrCode={qrCode}
      createdAt={l.created_at}
      fields={[
        { label: "Lý do", value: l.reason },
        { label: "Người lập", value: l.creator?.name },
        { label: "Người duyệt", value: l.approver?.name },
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.5 },
        { label: "Biến thể", flex: 1.3 },
        { label: "Đơn vị", flex: 0.6 },
        { label: "Số lượng", flex: 0.7 },
        { label: "Phương thức", flex: 0.9 },
        { label: "Giá trị", flex: 0.9, align: "right" },
        { label: "Tiền thu", flex: 0.9, align: "right" },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
        i.variants?.unit ?? "—",
        i.quantity,
        LIQUIDATION_METHOD[i.method] ?? i.method,
        i.unit_value != null ? formatVnd(i.unit_value) : "—",
        formatVnd(i.proceeds ?? 0),
      ])}
      signers={["Người lập", "Người duyệt", "Người nhận"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${l.code}.pdf"` },
  });
}
