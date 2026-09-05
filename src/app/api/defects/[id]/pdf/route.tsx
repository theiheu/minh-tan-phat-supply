import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { requireManager } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { variantLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireManager();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("defect_notes")
    .select("code, created_at, reporter:profiles!defect_notes_reported_by_fkey(name), source:stock_locations!defect_notes_source_location_id_fkey(name)")
    .eq("id", id)
    .single();
  if (!d) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  const { data: items } = await supabase
    .from("defect_note_items")
    .select("quantity, damage_detail, variants(attributes, unit, products(name))")
    .eq("defect_note_id", id);

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU GHI NHẬN VẬT TƯ HỎNG"
      code={d.code}
      date={formatDate(d.created_at)}
      info={[
        ["Người báo", d.reporter?.name ?? ""],
        ["Kho nguồn", d.source?.name ?? ""],
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.6 },
        { label: "Biến thể", flex: 1.4 },
        { label: "Số lượng", flex: 0.8 },
        { label: "Chi tiết hỏng", flex: 2.6 },
      ]}
      rows={(items ?? []).map((i) => [
        i.variants?.products?.name ?? "—",
        variantLabel(i.variants?.attributes, i.variants?.unit),
        i.quantity,
        i.damage_detail ?? "",
      ])}
      signers={["Người báo", "Người xác nhận"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${d.code}.pdf"` },
  });
}
