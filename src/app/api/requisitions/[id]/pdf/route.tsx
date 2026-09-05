import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { RequisitionPDF } from "@/features/requisitions/components/requisition-pdf";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { requireProfile } from "@/lib/auth";
import { isPrivileged } from "@/lib/types";
import { variantLabel } from "@/lib/labels";
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

  const buffer = await renderToBuffer(
    <RequisitionPDF
      code={req.code}
      status={req.status}
      type={req.requisition_type}
      requester={req.requester?.name ?? "—"}
      zone={req.zone?.name ?? "—"}
      purpose={req.purpose}
      createdAt={req.created_at}
      items={(items ?? []).map((i) => ({
        name: i.variants?.products?.name ?? "—",
        label: variantLabel(i.variants?.attributes, i.variants?.unit),
        unit: i.variants?.unit,
        quantity: i.quantity,
      }))}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${req.code}.pdf"`,
    },
  });
}
