import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { REQUISITION_STATUS, REQUISITION_TYPE, variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("requisitions")
    .select(
      "*, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name)",
    )
    .eq("id", id)
    .single();
  if (!req) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const isOwnerOrManager = isPrivileged(profile.role) || profile.id === req.requester_id;
  if (!isOwnerOrManager) return new NextResponse("Không có quyền", { status: 403 });

  const { data: items } = await supabase
    .from("requisition_items")
    .select("quantity, variants(attributes, unit, products(name))")
    .eq("requisition_id", id);

  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/requisitions/${id}`));

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU YÊU CẦU VẬT TƯ"
      code={req.code}
      qrCode={qrCode}
      createdAt={req.created_at}
      fields={[
        { label: "Người yêu cầu", value: req.requester?.name },
        { label: "Khu vực", value: req.zone?.name },
        { label: "Loại", value: REQUISITION_TYPE[req.requisition_type] ?? req.requisition_type },
        { label: "Trạng thái", value: REQUISITION_STATUS[req.status] ?? req.status },
        { label: "Mục đích", value: req.purpose },
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.6 },
        { label: "Biến thể", flex: 1.4 },
        { label: "Đơn vị", flex: 0.8 },
        { label: "Số lượng", flex: 0.8, align: "right" },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
        i.variants?.unit ?? "—",
        i.quantity,
      ])}
      signers={["Người yêu cầu", "Người duyệt", "Người cấp phát", "Người nhận"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${req.code}.pdf"`,
    },
  });
}
