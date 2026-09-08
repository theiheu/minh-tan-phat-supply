import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { TOOL_BORROWING_STATUS, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { isPrivileged } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: b } = await supabase
    .from("tool_borrowings")
    .select(`
      id,
      code,
      borrower_id,
      purpose,
      borrowed_at,
      expected_return_date,
      returned_at,
      status,
      created_at,
      borrower:profiles!tool_borrowings_borrower_id_fkey(name),
      zone:zones!tool_borrowings_zone_id_fkey(name),
      issued_by_profile:profiles!tool_borrowings_issued_by_fkey(name),
      received_back_by_profile:profiles!tool_borrowings_received_back_by_fkey(name)
    `)
    .eq("id", id)
    .single();

  if (!b) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const isOwnerOrManager = isPrivileged(profile.role) || profile.id === b.borrower_id;
  if (!isOwnerOrManager) return new NextResponse("Không có quyền", { status: 403 });

  const { data: items } = await supabase
    .from("tool_borrowing_items")
    .select(`
      quantity,
      returned_quantity,
      notes,
      variants(attributes, unit, products(name))
    `)
    .eq("borrowing_id", id);

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/tools`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU MƯỢN DỤNG CỤ"
      code={b.code}
      qrCode={qrCode}
      createdAt={b.created_at || b.borrowed_at}
      fields={[
        { label: "Người mượn", value: b.borrower?.name },
        { label: "Khu vực / Trại", value: b.zone?.name },
        { label: "Mục đích", value: b.purpose },
        {
          label: "Hạn dự kiến trả",
          value: b.expected_return_date ? formatDate(b.expected_return_date) : "Không xác định",
        },
        {
          label: "Trạng thái",
          value: TOOL_BORROWING_STATUS[b.status] ?? b.status,
        },
      ]}
      columns={[
        { label: "Tên dụng cụ / thiết bị", flex: 1.8 },
        { label: "Biến thể / Quy cách", flex: 1.4 },
        { label: "Đơn vị", flex: 0.7 },
        { label: "SL mượn", flex: 0.7, align: "right" },
        { label: "SL đã trả", flex: 0.7, align: "right" },
        { label: "Ghi chú", flex: 1.2 },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
        i.variants?.unit ?? "—",
        i.quantity,
        i.returned_quantity ?? 0,
        i.notes ?? "",
      ])}
      signers={["Người mượn", "Người giao", "Người nhận lại"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${b.code}.pdf"`,
    },
  });
}
