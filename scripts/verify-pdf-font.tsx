// scripts/verify-pdf-font.ts — kiểm tra in PDF tiếng Việt (phase 8)
// Chạy: bun run scripts/verify-pdf-font.ts
//
// 1) Roboto (public/fonts) có đủ glyph dấu tiếng Việt (ế ơ ạ đ ộ ứ …).
// 2) SlipDocument + RequisitionPDF render ra PDF hợp lệ với nội dung tiếng Việt.
// 3) Xuất 2 file PDF mẫu vào .tmp/pdf-smoke/ để xem bằng mắt.

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { ensurePdfFonts } from "../src/features/pdf/fonts";
import { SlipDocument } from "../src/features/pdf/slip";

// fontkit: dùng bản CommonJS (dist/main.cjs) cho tương thích Bun; gõ kiểu tối thiểu cục bộ.
const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  openSync(path: string): { hasGlyphForCodePoint(codePoint: number): boolean };
};

const SAMPLE = "TRẠI GÀ MINH TÂN PHÁT — ế ơ ạ đ ộ ứ ợ ữ ề Ông Nguyễn Văn Đức";
const CHARS = "TRẠIGÀMINHTÂNPHÁTếơạđộứợữềÔngNguynVnĐức";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ✓ " + msg);
}

function missingGlyphs(fontPath: string): string[] {
  const font = fontkit.openSync(fontPath);
  const missing = new Set<string>();
  for (const ch of CHARS) {
    if (!font.hasGlyphForCodePoint(ch.codePointAt(0)!)) missing.add(ch);
  }
  return [...missing];
}

async function main() {
  console.log("== 1. Glyph tiếng Việt trong Roboto ==");
  const missingRegular = missingGlyphs(join(process.cwd(), "public/fonts/Roboto-Regular.ttf"));
  const missingBold = missingGlyphs(join(process.cwd(), "public/fonts/Roboto-Bold.ttf"));
  assert(missingRegular.length === 0, `Roboto-Regular đủ glyph VN${missingRegular.length ? " thiếu " + missingRegular.join("") : ""}`);
  assert(missingBold.length === 0, `Roboto-Bold đủ glyph VN${missingBold.length ? " thiếu " + missingBold.join("") : ""}`);

  console.log("== 2. Render PDF thử ==");
  ensurePdfFonts();

  const grn = await renderToBuffer(
    <SlipDocument
      title="PHIẾU NHẬP KHO"
      code="GRN-2025-0001"
      date="05/09/2025"
      info={[
        ["Nhà cung cấp", "Công ty TNHH Thú y Dược phẩm Nam Đồng"],
        ["Người lập", "Trần Thị Hương"],
        ["Ghi chú", "Nhập theo hợp đồng ệ ộ — kiểm tra đạt"],
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.6 },
        { label: "Biến thể", flex: 1.3 },
        { label: "Đơn vị", flex: 0.7 },
        { label: "Số lượng", flex: 0.8 },
        { label: "Đơn giá", flex: 1.0 },
        { label: "Thành tiền", flex: 1.0 },
        { label: "Lô", flex: 0.9 },
        { label: "Hạn sử dụng", flex: 0.9 },
      ]}
      rows={[
        ["Vắc-xin Gumboro (chủng 228E)", "1000 liều", "liều", 10, "125.000 đ", "1.250.000 đ", "L228E-01", "30/06/2026"],
        ["Thuốc sát trùng Iodine 10%", "5 lít/can", "can", 2, "480.000 đ", "960.000 đ", "", "31/12/2025"],
      ]}
      signers={["Người lập", "Thủ kho", "Người duyệt"]}
      totalNote="Tổng tiền: 2.210.000 đ"
    />,
  );
  assert(grn.slice(0, 5).toString() === "%PDF-", `GRN là file PDF hợp lệ (${grn.length} bytes)`);

  const grnBuffer = Buffer.from(grn);
  const grnHasText = grnBuffer.includes(Buffer.from("PHIẾU")) || grnBuffer.length > 1500;
  assert(grnHasText, "GRN có nội dung (không phải PDF rỗng)");

  const outDir = join(process.cwd(), ".tmp/pdf-smoke");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "grn-sample.pdf"), grnBuffer);
  console.log("  đã ghi .tmp/pdf-smoke/grn-sample.pdf");

  // RequisitionPDF dùng import alias "@/..." — kiểm tra bun resolve được tsconfig paths.
  const { RequisitionPDF } = await import("../src/features/requisitions/components/requisition-pdf");
  const req = await renderToBuffer(
    <RequisitionPDF
      code="REQ-2025-0101"
      status="issued"
      type="new_supply"
      requester={SAMPLE}
      zone="Khu chuồng A2"
      purpose="Bổ sung vật tư tiêu hao tháng 9"
      createdAt="2025-09-05T08:30:00.000Z"
      items={[
        { name: "Vắc-xin Gumboro (chủng 228E)", label: "1000 liều", unit: "liều", quantity: 10 },
        { name: "Bột khử mùi chuồng", label: "25 kg/bao", unit: "bao", quantity: 4 },
      ]}
    />,
  );
  assert(req.slice(0, 5).toString() === "%PDF-", `REQ là file PDF hợp lệ (${req.length} bytes)`);
  writeFileSync(join(outDir, "req-sample.pdf"), Buffer.from(req));
  console.log("  đã ghi .tmp/pdf-smoke/req-sample.pdf");

  console.log("\nOK — font tiếng Việt + render PDF đạt. Mở .tmp/pdf-smoke/*.pdf để kiểm tra bằng mắt.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
