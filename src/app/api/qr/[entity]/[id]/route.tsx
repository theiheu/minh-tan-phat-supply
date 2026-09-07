// Route in mã QR (nhãn dán): /api/qr/{entity}/{id}
//
// Tạo 1 trang PDF A4 với mã QR lớn + tên loại phiếu + mã phiếu để cắt dán lên
// hàng hóa. Mã QR mã hóa ĐÚNG cùng liên kết phiếu như mã QR trên phiếu in PDF
// (xem các route /api/<loại>/[id]/pdf) để nhất quán khi quét.
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { ensurePdfFonts } from "@/features/pdf/fonts";
import { QrLabelDocument, type QrLabelSize } from "@/features/pdf/qr-label";
import { generateQrDataUri, getSlipUrl } from "@/features/pdf/qr";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface QrEntityConfig {
  /** Đường dẫn trang phiếu — giữ nguyên như mã QR trên phiếu in. */
  pagePath: (id: string) => string;
  /** Tiêu đề in trên nhãn. */
  title: string;
}

const QR_ENTITIES: Record<string, QrEntityConfig> = {
  requisition: { pagePath: (id) => `/requisitions/${id}`, title: "PHIẾU YÊU CẦU VẬT TƯ" },
  receipt: { pagePath: (id) => `/receipts/${id}`, title: "PHIẾU ĐẶT HÀNG & NHẬP KHO" },
  issue: { pagePath: (id) => `/issues/${id}`, title: "PHIẾU XUẤT KHO" },
  defect: { pagePath: () => "/defects", title: "PHIẾU BÁO HỎNG" },
  repair: { pagePath: () => "/repairs", title: "PHIẾU SỬA CHỮA" },
  liquidation: { pagePath: () => "/liquidations", title: "PHIẾU THANH LÝ" },
  stocktake: { pagePath: () => "/stocktake", title: "PHIẾU KIỂM KÊ" },
};

/** Lấy mã phiếu theo loại — mọi bảng đều có cột `code`. */
async function fetchSlipCode(entity: string, id: string): Promise<{ code: string } | null> {
  const supabase = await createClient();
  switch (entity) {
    case "requisition":
      return (await supabase.from("requisitions").select("code").eq("id", id).single()).data;
    case "receipt":
      return (await supabase.from("receipts").select("code").eq("id", id).single()).data;
    case "issue":
      return (await supabase.from("issues").select("code").eq("id", id).single()).data;
    case "defect":
      return (await supabase.from("defect_notes").select("code").eq("id", id).single()).data;
    case "repair":
      return (await supabase.from("repair_orders").select("code").eq("id", id).single()).data;
    case "liquidation":
      return (await supabase.from("liquidation_notes").select("code").eq("id", id).single()).data;
    case "stocktake":
      return (await supabase.from("stocktake_sessions").select("code").eq("id", id).single()).data;
    default:
      return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await params;
  const config = QR_ENTITIES[entity];
  if (!config) return new NextResponse("Loại phiếu không hợp lệ", { status: 404 });

  await requireManager();
  ensurePdfFonts();

  const url = new URL(req.url);
  const sizeParam = url.searchParams.get("size") as QrLabelSize | null;
  const size: QrLabelSize =
    sizeParam === "k80" || sizeParam === "50x30" || sizeParam === "a4" ? sizeParam : "k58";

  const row = await fetchSlipCode(entity, id);
  if (!row) return new NextResponse("Không tìm thấy phiếu", { status: 404 });

  // width 512px để mã QR nét khi in kích thước lớn (nhãn dán hàng hóa).
  const qrCode = await generateQrDataUri(getSlipUrl(req, config.pagePath(id)), 512);

  const buffer = await renderToBuffer(
    <QrLabelDocument title={config.title} code={row.code} qrCode={qrCode} size={size} />,
  );

  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${row.code}-maqr-${size}.pdf"`,
    },
  });
}
