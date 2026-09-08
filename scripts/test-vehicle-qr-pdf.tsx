import { renderToBuffer } from "@react-pdf/renderer";
import { ensurePdfFonts } from "../src/features/pdf/fonts";
import { generateQrDataUri } from "../src/features/pdf/qr";
import { VehicleQrLabelDocument } from "../src/features/pdf/vehicle-qr-label";

async function test() {
  console.log("Testing PDF generation for Vehicle QR Label...");
  ensurePdfFonts();
  const qrCode = await generateQrDataUri("VEH_61C12345_HOWO", 512);
  console.log("QR Data URI generated, length:", qrCode.length);

  const buffer = await renderToBuffer(
    <VehicleQrLabelDocument
      qrCode={qrCode}
      vehicle={{
        code: "61C-123.45",
        name: "Xe ben Howo 4 chân",
        fuelTypeName: "Dầu Diesel DO 0.05S",
        zoneName: "Khu 1",
      }}
    />
  );
  console.log("✓ PDF Buffer generated successfully, size:", buffer.byteLength, "bytes");
}

test().catch(console.error);
