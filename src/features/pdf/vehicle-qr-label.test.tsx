import { describe, expect, it } from "vitest";
import { generateQrDataUri } from "./qr";
import { VehicleQrLabelDocument } from "./vehicle-qr-label";

describe("VehicleQrLabelDocument", () => {
  it("accepts the vehicle details and QR data needed by a decal", async () => {
    const qrCode = await generateQrDataUri("VEH_61C12345_A8B9", 512);
    const doc = (
      <VehicleQrLabelDocument
        qrCode={qrCode}
        vehicle={{
          code: "61C-123.45",
          name: "Xe ben Howo 4 chân",
          fuelTypeName: "Dầu Diesel DO 0.05S-II",
          zoneName: "Đội xe 1",
        }}
      />
    );

    expect(doc.props.qrCode).toBe(qrCode);
    expect(doc.props.vehicle.code).toBe("61C-123.45");
    expect(doc.props.vehicle.fuelTypeName).toBe("Dầu Diesel DO 0.05S-II");
    expect(doc.props.vehicle.zoneName).toBe("Đội xe 1");
  });
});
