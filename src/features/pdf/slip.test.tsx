import { describe, it, expect } from "vitest";
import { SlipDocument } from "./slip";
import { generateQrDataUri } from "./qr";

describe("SlipDocument", () => {
  it("creates a valid document structure with QR code", async () => {
    const qrCode = await generateQrDataUri("http://localhost:3000/requisitions/test-1");
    const doc = (
      <SlipDocument
        title="PHIẾU YÊU CẦU VẬT TƯ"
        code="PYC-0001"
        qrCode={qrCode}
        createdAt="2026-09-06T00:00:00.000Z"
        fields={[{ label: "Người yêu cầu", value: "Nguyễn Văn A" }]}
        columns={[
          { label: "Tên vật tư", flex: 2 },
          { label: "Số lượng", flex: 1, align: "right" },
        ]}
        rows={[["Găng tay", 10]]}
      />
    );

    expect(doc).toBeDefined();
    expect(doc.props.qrCode).toBe(qrCode);
    expect(doc.props.code).toBe("PYC-0001");
    expect(doc.props.title).toBe("PHIẾU YÊU CẦU VẬT TƯ");
  });
});
