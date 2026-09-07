import { describe, it, expect } from "vitest";
import { QrLabelDocument } from "./qr-label";
import { generateQrDataUri } from "./qr";

describe("QrLabelDocument", () => {
  it("creates a label document with title, code and QR data", async () => {
    const qrCode = await generateQrDataUri("http://localhost:3000/issues/test-1", 512);
    const doc = <QrLabelDocument title="PHIẾU XUẤT KHO" code="PXK-0001" qrCode={qrCode} />;

    expect(doc).toBeDefined();
    expect(doc.props.title).toBe("PHIẾU XUẤT KHO");
    expect(doc.props.code).toBe("PXK-0001");
    expect(doc.props.qrCode).toBe(qrCode);
  });

  it("supports multiple sizes: k58, k80, 50x30, a4", async () => {
    const qrCode = await generateQrDataUri("http://localhost:3000/issues/test-1", 512);
    const k58 = <QrLabelDocument title="PHIẾU XUẤT KHO" code="PXK-0001" qrCode={qrCode} size="k58" />;
    const k80 = <QrLabelDocument title="PHIẾU XUẤT KHO" code="PXK-0001" qrCode={qrCode} size="k80" />;
    const label = <QrLabelDocument title="PHIẾU XUẤT KHO" code="PXK-0001" qrCode={qrCode} size="50x30" />;
    const a4 = <QrLabelDocument title="PHIẾU XUẤT KHO" code="PXK-0001" qrCode={qrCode} size="a4" />;

    expect(k58.props.size).toBe("k58");
    expect(k80.props.size).toBe("k80");
    expect(label.props.size).toBe("50x30");
    expect(a4.props.size).toBe("a4");
  });
});
