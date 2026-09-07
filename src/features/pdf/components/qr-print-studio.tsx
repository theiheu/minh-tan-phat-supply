"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  ImageIcon,
  Printer,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type QrLabelSize } from "@/features/pdf/qr-label";

interface QrPrintStudioProps {
  entity: string;
  id: string;
  code: string;
  title: string;
  qrDataUri: string;
  backHref?: string;
}

const PRESETS: {
  id: QrLabelSize;
  name: string;
  desc: string;
  badge?: string;
  widthMm: number;
}[] = [
  {
    id: "k58",
    name: "Máy in mini K58 (58mm)",
    desc: "Khổ cuộn nhiệt 58mm cho máy in mini cầm tay Bluetooth",
    badge: "Phổ biến",
    widthMm: 48,
  },
  {
    id: "k80",
    name: "Máy in nhiệt K80 (80mm)",
    desc: "Khổ cuộn nhiệt 80mm cho máy in hóa đơn để bàn",
    widthMm: 72,
  },
  {
    id: "50x30",
    name: "Tem Decal 50x30mm",
    desc: "Tem decal dán nhỏ gọn cho máy in mã vạch / tem nhãn",
    widthMm: 48,
  },
  {
    id: "a4",
    name: "Giấy A4 (In & cắt)",
    desc: "In ra giấy A4 trên máy in văn phòng thường có khung nét đứt",
    widthMm: 120,
  },
];

export function QrPrintStudio({
  entity,
  id,
  code,
  title,
  qrDataUri,
  backHref,
}: QrPrintStudioProps) {
  const router = useRouter();
  const [size, setSize] = useState<QrLabelSize>("k58");
  const [savingImage, setSavingImage] = useState(false);
  const [copied, setCopied] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  // In trực tiếp qua lệnh in của trình duyệt
  function handleDirectPrint() {
    window.print();
  }

  // Tạo ảnh PNG chất lượng cao chuẩn máy in nhiệt (203 DPI)
  async function generateCanvas(targetSize: QrLabelSize): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Không thể tạo canvas context"));

        // 8 dots/mm (203 DPI chuẩn máy in nhiệt)
        let w = 464; // 58mm * 8
        let h = 600;

        if (targetSize === "k80") {
          w = 576; // 72mm printable width
          h = 700;
        } else if (targetSize === "50x30") {
          w = 400; // 50mm
          h = 240; // 30mm
        } else if (targetSize === "a4") {
          w = 800;
          h = 1000;
        }

        canvas.width = w;
        canvas.height = h;

        // Nền trắng tinh khiết
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#000000";

        if (targetSize === "50x30") {
          // Layout tem ngang 50x30mm
          const qrSize = Math.min(h - 20, 200);
          ctx.drawImage(img, 10, (h - qrSize) / 2, qrSize, qrSize);

          const textX = qrSize + 25;
          ctx.font = "bold 20px system-ui, sans-serif";
          ctx.fillText(title, textX, 50);

          ctx.font = "bold 32px ui-monospace, monospace";
          ctx.fillText(code, textX, 105);

          ctx.font = "16px system-ui, sans-serif";
          ctx.fillStyle = "#555555";
          ctx.fillText("Quét mã xem phiếu", textX, 150);
        } else {
          // Layout dọc (K58, K80, A4)
          ctx.textAlign = "center";

          // Tiêu đề
          ctx.font = `bold ${targetSize === "k80" ? "28px" : targetSize === "a4" ? "32px" : "24px"} system-ui, sans-serif`;
          ctx.fillText(title, w / 2, targetSize === "k80" ? 50 : 42);

          // Mã phiếu
          ctx.font = `bold ${targetSize === "k80" ? "42px" : targetSize === "a4" ? "48px" : "36px"} ui-monospace, monospace`;
          ctx.fillText(code, w / 2, targetSize === "k80" ? 105 : 90);

          // Mã QR
          const qrDim = targetSize === "k80" ? 360 : targetSize === "a4" ? 440 : 300;
          const qrY = targetSize === "k80" ? 130 : 110;
          ctx.drawImage(img, (w - qrDim) / 2, qrY, qrDim, qrDim);

          // Ghi chú dưới QR
          ctx.font = `18px system-ui, sans-serif`;
          ctx.fillStyle = "#444444";
          ctx.fillText("Quét mã để xem thông tin phiếu", w / 2, qrY + qrDim + 35);
        }

        resolve(canvas);
      };
      img.onerror = () => reject(new Error("Không thể tải ảnh mã QR"));
      img.src = qrDataUri;
    });
  }

  // Tải ảnh PNG
  async function handleDownloadImage() {
    setSavingImage(true);
    try {
      const canvas = await generateCanvas(size);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${code}-qr-${size}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Đã tải ảnh tem mã QR thành công");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh thất bại");
    } finally {
      setSavingImage(false);
    }
  }

  // Sao chép ảnh vào clipboard để dán vào app máy in Bluetooth
  async function handleCopyImage() {
    if (!navigator.clipboard || !window.ClipboardItem) {
      toast.info("Trình duyệt không hỗ trợ sao chép ảnh trực tiếp, hãy dùng nút 'Lưu ảnh'");
      return;
    }
    setSavingImage(true);
    try {
      const canvas = await generateCanvas(size);
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error("Không thể xuất blob");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        toast.success("Đã sao chép ảnh tem vào bộ nhớ tạm! Bạn có thể dán vào app máy in.");
        setTimeout(() => setCopied(false), 3000);
      });
    } catch (err) {
      toast.error("Không thể sao chép ảnh: " + (err instanceof Error ? err.message : ""));
    } finally {
      setSavingImage(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-16">
      {/* CSS In chuyên dụng cho máy in nhiệt mini và AirPrint */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0 !important;
            size: auto !important;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          nav,
          header,
          aside,
          footer,
          .app-sidebar {
            display: none !important;
          }
          .print-area-wrapper {
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .thermal-label-print {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-inside: avoid !important;
          }
          .thermal-label-k58 {
            width: 48mm !important;
            max-width: 48mm !important;
            padding: 2mm 1mm !important;
            margin: 0 auto !important;
          }
          .thermal-label-k80 {
            width: 72mm !important;
            max-width: 72mm !important;
            padding: 3mm 2mm !important;
            margin: 0 auto !important;
          }
          .thermal-label-50x30 {
            width: 48mm !important;
            max-width: 48mm !important;
            height: 28mm !important;
            padding: 1mm !important;
            margin: 0 auto !important;
          }
          .thermal-label-a4 {
            width: 160mm !important;
            max-width: 160mm !important;
            padding: 10mm !important;
            margin: 15mm auto !important;
            border: 1.5pt dashed #000000 !important;
          }
        }
      `}</style>

      {/* Header thanh công cụ (Ẩn khi in) */}
      <div className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              aria-label="Quay lại"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-foreground">In mã QR nhãn dán</h1>
                <Badge variant="outline" className="font-mono text-xs">
                  {code}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Tối ưu cho máy in nhiệt mini cầm tay, Bluetooth và tem decal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleDirectPrint}
              size="sm"
              className="h-9 gap-1.5 font-semibold shadow-sm text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Printer className="size-4" />
              In ngay
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6 sm:py-6 space-y-5">
        {/* Chọn khổ máy in (Ẩn khi in) */}
        <div className="no-print space-y-2.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            1. Chọn khổ máy in / tem nhãn
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {PRESETS.map((p) => {
              const isSelected = size === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSize(p.id)}
                  className={`relative flex flex-col items-start rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 text-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-xs text-foreground">{p.name}</span>
                    {p.badge && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] leading-tight text-muted-foreground">{p.desc}</span>
                  {isSelected && (
                    <div className="absolute right-2 bottom-2 size-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Khung xem trước nhãn tem (Chính là phần sẽ được in) */}
        <div className="space-y-2">
          <div className="no-print flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              2. Xem trước nhãn dán
            </label>
            <span className="text-xs text-muted-foreground">
              {size === "k58" && "Khổ giấy 58mm"}
              {size === "k80" && "Khổ giấy 80mm"}
              {size === "50x30" && "Khổ tem 50x30mm"}
              {size === "a4" && "Khổ giấy A4"}
            </span>
          </div>

          <div className="print-area-wrapper flex justify-center rounded-2xl border bg-muted/40 p-4 sm:p-8">
            <div
              ref={labelRef}
              className={`thermal-label-print bg-white text-black border-2 border-black/80 shadow-md transition-all ${
                size === "k58"
                  ? "thermal-label-k58 w-[240px] p-3 rounded-lg text-center"
                  : size === "k80"
                    ? "thermal-label-k80 w-[310px] p-4 rounded-lg text-center"
                    : size === "50x30"
                      ? "thermal-label-50x30 w-[260px] p-2.5 rounded-lg flex items-center gap-2.5"
                      : "thermal-label-a4 w-[360px] p-6 rounded-lg text-center border-dashed"
              }`}
            >
              {size === "50x30" ? (
                /* Layout tem decal ngang */
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUri}
                    alt={`Mã QR ${code}`}
                    className="size-20 shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[10px] font-bold text-gray-700 uppercase tracking-tight truncate">
                      {title}
                    </div>
                    <div className="font-mono text-sm font-black text-black leading-tight my-0.5">
                      {code}
                    </div>
                    <div className="text-[9px] text-gray-500 leading-none">
                      Quét mã xem chi tiết phiếu
                    </div>
                  </div>
                </>
              ) : (
                /* Layout tem cuộn dọc */
                <div className="flex flex-col items-center">
                  <div
                    className={`font-bold uppercase tracking-wide text-gray-800 ${
                      size === "k80" ? "text-xs" : size === "a4" ? "text-sm" : "text-[11px]"
                    }`}
                  >
                    {title}
                  </div>
                  <div
                    className={`font-mono font-black text-black my-1 ${
                      size === "k80"
                        ? "text-xl tracking-wide"
                        : size === "a4"
                          ? "text-2xl"
                          : "text-base tracking-wide"
                    }`}
                  >
                    {code}
                  </div>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUri}
                    alt={`Mã QR ${code}`}
                    className={`object-contain my-1 ${
                      size === "k80" ? "size-44" : size === "a4" ? "size-52" : "size-36"
                    }`}
                  />

                  <div
                    className={`text-gray-600 mt-0.5 ${
                      size === "k80" || size === "a4" ? "text-xs" : "text-[10px]"
                    }`}
                  >
                    Quét mã để mở thông tin phiếu
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bảng điều khiển hành động cho điện thoại & máy in mini (Ẩn khi in) */}
        <div className="no-print space-y-3 pt-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            3. Thao tác in & xuất tem
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* 1. In trực tiếp qua trình duyệt */}
            <Button
              onClick={handleDirectPrint}
              size="lg"
              className="h-12 w-full gap-2 text-sm font-semibold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Printer className="size-4" />
              In trực tiếp (Trình duyệt)
            </Button>

            {/* 2. Lưu ảnh tem PNG để mở app máy in Bluetooth */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadImage}
              disabled={savingImage}
              className="h-12 w-full gap-2 text-sm font-medium border-2"
            >
              <ImageIcon className="size-4 text-primary" />
              {savingImage ? "Đang tạo ảnh…" : "Lưu ảnh tem (PNG)"}
            </Button>

            {/* 3. Tải PDF khổ tương ứng */}
            <Button
              variant="outline"
              size="lg"
              asChild
              className="h-12 w-full gap-2 text-sm font-medium border-2"
            >
              <a href={`/api/qr/${entity}/${id}?size=${size}`} target="_blank" rel="noreferrer">
                <FileText className="size-4 text-primary" />
                Tải file PDF ({size.toUpperCase()})
              </a>
            </Button>
          </div>

          {/* Nút phụ: Sao chép ảnh */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Smartphone className="size-4 text-muted-foreground" />
              <span>
                Mẹo: Trên điện thoại, bạn có thể bấm <strong>&quot;Lưu ảnh tem&quot;</strong> rồi mở bằng app
                của máy in (Niimbot, PeriPage, Xprinter...) để in ngay.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyImage}
              disabled={savingImage}
              className="h-8 gap-1 text-xs"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              {copied ? "Đã sao chép ảnh" : "Sao chép ảnh"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
