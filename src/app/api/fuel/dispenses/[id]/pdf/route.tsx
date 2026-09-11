import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { formatZoneLabel } from "@/lib/format-zone";
import { SlipDocument } from "@/features/pdf/slip";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireProfile } from "@/lib/auth";
import { formatConsumptionRate, formatFuelLiters, formatOdo } from "@/lib/fuel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  ensurePdfFonts();
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("fuel_dispenses")
    .select(
      "code, quantity, current_odo, previous_odo, usage_diff, consumption_rate, driver_name, notes, created_at, vehicle:vehicles(code, name, odo_unit, fuel_norm), zone:zones(name), sub_zone:sub_zones(name), fuel_type:fuel_types(name, unit), dispenser:profiles!fuel_dispenses_dispenser_id_fkey(name)"
    )
    .eq("id", id)
    .single();

  if (!d) return new NextResponse("Không tìm thấy phiếu cấp dầu", { status: 404 });

  const odoUnit = d.vehicle?.odo_unit ?? "km";
  const qrCode = await generateQrDataUri(getSlipUrl(_req, `/fuel?tab=dispenses`));

  const leftFields = [
    { label: "Phương tiện nhận", value: d.vehicle ? `${d.vehicle.code} - ${d.vehicle.name}` : "Cấp ngoài / Không chọn xe" },
    { label: "Khu vực / Công trình", value: formatZoneLabel(d.zone?.name, d.sub_zone?.name) },
    { label: "Tài xế / Người nhận", value: d.driver_name ?? "—" },
    { label: "Người cấp dầu", value: d.dispenser?.name ?? "—" },
    { label: "Ghi chú", value: d.notes },
  ];

  const rightFields = [];
  if (d.current_odo != null) {
    rightFields.push({ label: "Chỉ số Odo mới", value: formatOdo(Number(d.current_odo), odoUnit) });
  }
  if (d.usage_diff != null && Number(d.usage_diff) > 0) {
    rightFields.push({ label: "Quãng đường / Giờ", value: `+${formatOdo(Number(d.usage_diff), odoUnit)}` });
  }
  if (d.consumption_rate != null) {
    rightFields.push({ label: "Tiêu hao đo được", value: formatConsumptionRate(Number(d.consumption_rate), odoUnit) });
  }
  if (d.vehicle?.fuel_norm != null) {
    rightFields.push({ label: "Định mức quy định", value: formatConsumptionRate(Number(d.vehicle.fuel_norm), odoUnit) });
  }

  const buffer = await renderToBuffer(
    <SlipDocument
      title="PHIẾU CẤP PHÁT NHIÊN LIỆU"
      code={d.code}
      qrCode={qrCode}
      createdAt={d.created_at}
      fields={leftFields}
      rightPanel={rightFields.length > 0 ? { heading: "Thông tin vận hành & Tiêu hao", fields: rightFields } : undefined}
      columns={[
        { label: "TÊN NHIÊN LIỆU, DẦU NHỚT", flex: 2.8 },
        { label: "ĐVT", flex: 0.8, align: "center" },
        { label: "SỐ LƯỢNG CẤP", flex: 1.2, align: "right" },
        { label: "CHỈ SỐ ODO / GIỜ MÁY", flex: 1.6, align: "right" },
        { label: "GHI CHÚ", flex: 1.2 },
      ]}
      rows={[
        [
          d.fuel_type?.name ?? "Dầu / Nhiên liệu",
          d.fuel_type?.unit ?? "lít",
          formatFuelLiters(Number(d.quantity)),
          d.current_odo != null ? formatOdo(Number(d.current_odo), odoUnit) : "—",
          "",
        ],
      ]}
      totals={[{ left: "TỔNG CỘNG", right: `Tổng số lượng: ${formatFuelLiters(Number(d.quantity))}` }]}
      signers={["Người nhận (Lái xe)", "Người cấp phát", "Thủ kho / Quản lý", "Chủ trại"]}
    />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${d.code}.pdf"`,
    },
  });
}
