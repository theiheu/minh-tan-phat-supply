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

  it("creates a valid document structure for tool borrowing slip", async () => {
    const qrCode = await generateQrDataUri("http://localhost:3000/tools");
    const doc = (
      <SlipDocument
        title="PHIẾU MƯỢN DỤNG CỤ"
        code="MDC-0001"
        qrCode={qrCode}
        createdAt="2026-09-08T00:00:00.000Z"
        fields={[
          { label: "Người mượn", value: "Trần Văn B" },
          { label: "Khu vực / Trại", value: "Khu A" },
          { label: "Mục đích", value: "Hàn khung chuồng" },
          { label: "Hạn dự kiến trả", value: "10/09/2026" },
          { label: "Trạng thái", value: "Đang mượn" },
        ]}
        columns={[
          { label: "Tên dụng cụ / thiết bị", flex: 1.8 },
          { label: "Biến thể / Quy cách", flex: 1.4 },
          { label: "Đơn vị", flex: 0.7 },
          { label: "SL mượn", flex: 0.7, align: "right" },
          { label: "SL đã trả", flex: 0.7, align: "right" },
          { label: "Ghi chú", flex: 1.2 },
        ]}
        rows={[["Máy hàn", "200A", "cái", 1, 0, ""]]}
        signers={["Người mượn", "Người giao", "Người nhận lại"]}
      />
    );

    expect(doc).toBeDefined();
    expect(doc.props.qrCode).toBe(qrCode);
    expect(doc.props.code).toBe("MDC-0001");
    expect(doc.props.title).toBe("PHIẾU MƯỢN DỤNG CỤ");
    expect(doc.props.signers).toEqual(["Người mượn", "Người giao", "Người nhận lại"]);
  });
});
