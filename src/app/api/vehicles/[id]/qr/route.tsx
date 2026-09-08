import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { VehicleQrLabelDocument } from "@/features/pdf/vehicle-qr-label";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeFilename(code: string): string {
  return code.replace(/[^a-zA-Z0-9._-]+/g, "-") || "vehicle";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireProfile();
  const { id } = await params;
  const supabase = await createClient();
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("code, name, qr_token, zone:zones!vehicles_zone_id_fkey(name), fuel_type:fuel_types!vehicles_fuel_type_id_fkey(name)")
    .eq("id", id)
    .single();

  if (error || !vehicle) return new NextResponse("Không tìm thấy phương tiện", { status: 404 });

  try {
    ensurePdfFonts();
    const scanUrl = getSlipUrl(request, `/fuel/scan?vehicle=${encodeURIComponent(vehicle.qr_token)}`);
    const qrCode = await generateQrDataUri(scanUrl, 768);
    const buffer = await renderToBuffer(
      <VehicleQrLabelDocument
        qrCode={qrCode}
        vehicle={{
          code: vehicle.code,
          name: vehicle.name,
          fuelTypeName: vehicle.fuel_type?.name ?? null,
          zoneName: vehicle.zone?.name ?? null,
        }}
      />,
    );

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFilename(vehicle.code)}-tem-qr.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to render vehicle QR label", error);
    return new NextResponse("Không thể tạo tem QR", { status: 500 });
  }
}
