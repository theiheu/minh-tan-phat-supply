// scripts/verify-pdf-font.tsx — kiểm tra in PDF tiếng Việt (Task 6: smoke mẫu chuẩn)
// Chạy: bun run scripts/verify-pdf-font.tsx
//
// 1) Roboto (public/fonts) có đủ glyph dấu tiếng Việt (ế ơ ạ đ ộ ứ …).
// 2) SlipDocument (engine mẫu chuẩn) render 4 phiếu mẫu với props mới
//    (fields, rightPanel, columns, totals, amountInWords, signers):
//      - grn-sample.pdf      PHIẾU NHẬP KHO (mẫu receipts route)
//      - req-sample.pdf      PHIẾU YÊU CẦU VẬT TƯ (mẫu requisitions route)
//      - pxk-sample.pdf      PHIẾU XUẤT KHO bán cho khách (kèm rightPanel xe)
//      - pxk-khu-sample.pdf  PHIẾU XUẤT KHO nội bộ giữa các khu (không giá)
// 3) Xuất 4 file PDF mẫu vào .tmp/pdf-smoke/ để xem bằng mắt.

import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import type { JSX } from "react";
import { ensurePdfFonts } from "../src/features/pdf/fonts";
import { SlipDocument } from "../src/features/pdf/slip";
import { formatNumber, formatVnd } from "../src/lib/format";
import { formatAmountInWords } from "../src/lib/money-words";

// fontkit: dùng bản CommonJS (dist/main.cjs) cho tương thích Bun; gõ kiểu tối thiểu cục bộ.
const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as {
  openSync(path: string): { hasGlyphForCodePoint(codePoint: number): boolean };
};

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

// --- Dữ liệu mẫu 4 phiếu (dữ liệu giả, sát nghiệp vụ trại gà) ---

interface GrnItem {
  name: string;
  variant: string;
  unit: string;
  qty: number;
  unitCost: number;
  lot: string;
  expiry: string;
}

const GRN_ITEMS: GrnItem[] = [
  { name: "Cám gà đẻ 102", variant: "20 kg/bao", unit: "bao", qty: 100, unitCost: 245000, lot: "L2409-102", expiry: "24/02/2027" },
  { name: "Vắc-xin Newcastle (chủng Lasota)", variant: "1000 liều/lọ", unit: "liều", qty: 5000, unitCost: 350, lot: "LVN-2608", expiry: "30/09/2027" },
  { name: "Vắc-xin Gumboro (chủng 228E)", variant: "1000 liều/lọ", unit: "liều", qty: 5000, unitCost: 420, lot: "LGUM-2608", expiry: "30/09/2027" },
  { name: "Thuốc sát trùng Iodine 10%", variant: "5 lít/can", unit: "can", qty: 4, unitCost: 480000, lot: "LIO-2612", expiry: "31/12/2027" },
  { name: "Men tiêu hóa Bcomplex", variant: "1 kg/gói", unit: "gói", qty: 20, unitCost: 55000, lot: "LMB-2609", expiry: "30/11/2027" },
];

interface ReqItem {
  name: string;
  variant: string;
  unit: string;
  qty: number;
}

const REQ_ITEMS: ReqItem[] = [
  { name: "Cám gà đẻ 102", variant: "20 kg/bao", unit: "bao", qty: 60 },
  { name: "Vắc-xin Newcastle (chủng Lasota)", variant: "1000 liều/lọ", unit: "liều", qty: 2000 },
  { name: "Vắc-xin Gumboro (chủng 228E)", variant: "1000 liều/lọ", unit: "liều", qty: 2000 },
  { name: "Thuốc sát trùng Iodine 10%", variant: "5 lít/can", unit: "can", qty: 2 },
  { name: "Men tiêu hóa Bcomplex", variant: "1 kg/gói", unit: "gói", qty: 10 },
];

interface PxkItem {
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  note: string;
}

const PXK_ITEMS: PxkItem[] = [
  { name: "Trứng gà ta (loại 1)", unit: "trứng", qty: 4800, unitPrice: 3200, note: "" },
  { name: "Trứng gà ta (loại 2)", unit: "trứng", qty: 2400, unitPrice: 2900, note: "" },
  { name: "Trứng gà lơ-go (loại 1)", unit: "trứng", qty: 6000, unitPrice: 2600, note: "xe 51C-123.45" },
  { name: "Trứng gà lơ-go (loại 2)", unit: "trứng", qty: 2400, unitPrice: 2100, note: "" },
  { name: "Gà thải loại (1,8–2,0 kg/con)", unit: "con", qty: 120, unitPrice: 55000, note: "xuất cuối đợt" },
];

interface PxkKhuItem {
  name: string;
  unit: string;
  qty: number;
  note: string;
}

const PXK_KHU_ITEMS: PxkKhuItem[] = [
  { name: "Gà đẻ 35 tuần tuổi", unit: "con", qty: 1200, note: "đàn A2, đã soi loại" },
  { name: "Cám gà đẻ 102", unit: "bao", qty: 50, note: "20 kg/bao" },
  { name: "Vắc-xin Gumboro (chủng 228E)", unit: "liều", qty: 2000, note: "tiêm nhắc lúc 38 tuần tuổi" },
  { name: "Thuốc bổ điện giải", unit: "gói", qty: 30, note: "pha nước uống 3 ngày đầu" },
];

// --- Các phiếu mẫu ---

function grnSample(): JSX.Element {
  const total = GRN_ITEMS.reduce((n, i) => n + i.qty * i.unitCost, 0);
  return (
    <SlipDocument
      title="PHIẾU NHẬP KHO"
      code="GRN-0001"
      createdAt="2026-09-06T08:30:00+07:00"
      fields={[
        { label: "Nhà cung cấp", value: "Công ty TNHH Dược phẩm & Thú y An Phú" },
        { label: "Người lập", value: "Trần Thị Hương" },
        { label: "Ghi chú", value: "Nhập theo hợp đồng tháng 9/2026 — hàng kiểm tra đạt" },
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.5 },
        { label: "Biến thể", flex: 1.3 },
        { label: "Đơn vị", flex: 0.7 },
        { label: "Số lượng", flex: 0.8, align: "right" },
        { label: "Đơn giá", flex: 1.0, align: "right" },
        { label: "Thành tiền", flex: 1.0, align: "right" },
        { label: "Lô", flex: 0.8 },
        { label: "Hạn sử dụng", flex: 0.9 },
      ]}
      rows={GRN_ITEMS.map((i) => [
        i.name,
        i.variant,
        i.unit,
        i.qty,
        formatVnd(i.unitCost),
        formatVnd(i.qty * i.unitCost),
        i.lot,
        i.expiry,
      ])}
      totals={[{ left: "TỔNG CỘNG", right: formatVnd(total) }]}
      amountInWords={`Thành tiền bằng chữ: ${formatAmountInWords(total)}`}
      signers={["Người lập", "Thủ kho", "Người duyệt"]}
    />
  );
}

function reqSample(): JSX.Element {
  return (
    <SlipDocument
      title="PHIẾU YÊU CẦU VẬT TƯ"
      code="REQ-0001"
      createdAt="2026-09-05T09:00:00+07:00"
      fields={[
        { label: "Người yêu cầu", value: "Nguyễn Văn Nam" },
        { label: "Khu vực", value: "Khu B" },
        { label: "Loại", value: "Cấp mới" },
        { label: "Mục đích", value: "Cấp thức ăn, vắc-xin cho đàn gà đẻ Khu B tháng 9/2026" },
      ]}
      columns={[
        { label: "Tên vật tư", flex: 1.6 },
        { label: "Biến thể", flex: 1.4 },
        { label: "Đơn vị", flex: 0.8 },
        { label: "Số lượng", flex: 0.8, align: "right" },
      ]}
      rows={REQ_ITEMS.map((i) => [i.name, i.variant, i.unit, i.qty])}
      signers={["Người yêu cầu", "Người duyệt", "Người cấp phát", "Người nhận"]}
    />
  );
}

function pxkSample(): JSX.Element {
  const total = PXK_ITEMS.reduce((n, i) => n + i.qty * i.unitPrice, 0);
  return (
    <SlipDocument
      title="PHIẾU XUẤT KHO"
      code="PXK-0001"
      createdAt="2026-09-06T16:00:00+07:00"
      fields={[
        { label: "Bên nhận hàng", value: "Công ty TNHH Thực phẩm sạch Sài Gòn" },
        { label: "Địa chỉ", value: "Số 12 Trần Não, TP. Thủ Đức, TP. Hồ Chí Minh" },
        { label: "Số điện thoại", value: "0903 456 789" },
      ]}
      rightPanel={{
        heading: "Thông tin xe vận chuyển",
        fields: [
          { label: "Biển số xe", value: "51C-123.45" },
          { label: "Người vận chuyển", value: "Lê Văn Tài" },
        ],
      }}
      columns={[
        { label: "TÊN SẢN PHẨM HÀNG HÓA", flex: 2.2 },
        { label: "ĐVT", flex: 0.6 },
        { label: "SL", flex: 0.6 },
        { label: "ĐƠN GIÁ", flex: 0.9, align: "right" },
        { label: "THÀNH TIỀN", flex: 1.0, align: "right" },
        { label: "GHI CHÚ", flex: 1.2 },
      ]}
      rows={PXK_ITEMS.map((i) => [
        i.name,
        i.unit,
        i.qty,
        formatVnd(i.unitPrice),
        formatVnd(i.qty * i.unitPrice),
        i.note,
      ])}
      totals={[{ left: "TỔNG CỘNG", right: formatVnd(total) }]}
      amountInWords={`Thành tiền bằng chữ: ${formatAmountInWords(total)}`}
      signers={["Người nhận hàng", "Vận chuyển", "Người lập phiếu (Đại diện người bán)", "Chủ trại"]}
    />
  );
}

function pxkKhuSample(): JSX.Element {
  const totalQty = PXK_KHU_ITEMS.reduce((n, i) => n + i.qty, 0);
  return (
    <SlipDocument
      title="PHIẾU XUẤT KHO"
      code="PXK-0002"
      createdAt="2026-09-06T07:00:00+07:00"
      fields={[
        { label: "Nhận tại khu", value: "Khu A" },
        { label: "Xuất từ khu", value: "Khu B" },
        { label: "Mục đích", value: "Luân chuyển đàn gà đẻ 35 tuần tuổi sang Khu A" },
      ]}
      columns={[
        { label: "TÊN SẢN PHẨM HÀNG HÓA", flex: 2.2 },
        { label: "ĐVT", flex: 0.6 },
        { label: "SL", flex: 0.6, align: "right" },
        { label: "GHI CHÚ", flex: 2.0 },
      ]}
      rows={PXK_KHU_ITEMS.map((i) => [i.name, i.unit, i.qty, i.note])}
      totals={[{ left: "TỔNG CỘNG", right: `Tổng số lượng: ${formatNumber(totalQty)}` }]}
      signers={["Người nhận hàng", "Người lập phiếu", "Chủ trại"]}
    />
  );
}

async function renderSample(fileName: string, doc: JSX.Element): Promise<void> {
  const outDir = join(process.cwd(), ".tmp/pdf-smoke");
  mkdirSync(outDir, { recursive: true });

  const buffer = await renderToBuffer(doc);
  assert(buffer.slice(0, 5).toString() === "%PDF-", `${fileName} là file PDF hợp lệ (${buffer.length} bytes)`);
  assert(buffer.length > 5 * 1024, `${fileName} có dung lượng > 5 KB (${buffer.length} bytes)`);

  const outPath = join(outDir, fileName);
  writeFileSync(outPath, Buffer.from(buffer));
  console.log(`  đã ghi ${outPath} (${buffer.length} bytes)`);
}

async function main() {
  console.log("== 1. Glyph tiếng Việt trong Roboto ==");
  const missingRegular = missingGlyphs(join(process.cwd(), "public/fonts/Roboto-Regular.ttf"));
  const missingBold = missingGlyphs(join(process.cwd(), "public/fonts/Roboto-Bold.ttf"));
  assert(missingRegular.length === 0, `Roboto-Regular đủ glyph VN${missingRegular.length ? " thiếu " + missingRegular.join("") : ""}`);
  assert(missingBold.length === 0, `Roboto-Bold đủ glyph VN${missingBold.length ? " thiếu " + missingBold.join("") : ""}`);

  console.log("\n== 2. Render 4 phiếu mẫu (SlipDocument) ==");
  ensurePdfFonts();

  await renderSample("grn-sample.pdf", grnSample());
  await renderSample("req-sample.pdf", reqSample());
  await renderSample("pxk-sample.pdf", pxkSample());
  await renderSample("pxk-khu-sample.pdf", pxkKhuSample());

  console.log("\nOK — font tiếng Việt + 4 phiếu mẫu đạt. Mở .tmp/pdf-smoke/*.pdf để kiểm tra bằng mắt.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
