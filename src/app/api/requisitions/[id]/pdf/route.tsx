import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { formatZoneLabel } from "@/lib/format-zone";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { REQUISITION_STATUS, REQUISITION_TYPE } from "@/lib/labels";
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
      "*, requester:profiles!requisitions_requester_id_fkey(name), zone:zones!requisitions_zone_id_fkey(name), sub_zone:sub_zones!requisitions_sub_zone_id_fkey(name)",
    )
    .eq("id", id)
    .single();
  if (!req) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const isOwnerOrManager = isPrivileged(profile.role) || profile.id === req.requester_id;
  if (!isOwnerOrManager) return new NextResponse("Không có quyền", { status: 403 });

  const { data: items } = await supabase
    .from("requisition_items")
    .select("quantity, skus(id, sku_code, products(name), units(name, symbol), sku_attribute_values(text_value, numeric_value, legacy_text_value, units(symbol)))")
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
        { label: "Khu vực", value: formatZoneLabel(req.zone?.name, req.sub_zone?.name) },
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
        const attrVals = (v?.sku_attribute_values ?? []).map(av => av.text_value || av.legacy_text_value || (av.numeric_value ? `${av.numeric_value} ${av.units?.symbol ?? ""}`.trim() : null)).filter(Boolean);
        const detail = attrVals.length > 0 ? attrVals.join(" · ") : "—";
        return [
          v?.products?.name ?? "—",
          detail,
          v?.units?.symbol || v?.units?.name || "—",
          i.quantity,
        ];
      })}
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
