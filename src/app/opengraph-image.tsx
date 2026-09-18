import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

export const alt = "Quản lý Kho Trại Gà Minh Tân Phát";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const rootDir = process.cwd();
  const fontBold = await readFile(join(rootDir, "public/fonts/Roboto-Bold.ttf"));
  const fontRegular = await readFile(join(rootDir, "public/fonts/Roboto-Regular.ttf"));
  const logoBuffer = await readFile(join(rootDir, "public/brand/logo.png"));
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#090d16",
          backgroundImage:
            "radial-gradient(circle at 90% 15%, rgba(234, 88, 12, 0.28) 0%, transparent 50%), radial-gradient(circle at 10% 85%, rgba(245, 158, 11, 0.2) 0%, transparent 45%), linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1a1e2e 100%)",
          padding: "54px 64px",
          fontFamily: "Roboto",
          color: "#ffffff",
          position: "relative",
        }}
      >
        {/* Decorative border */}
        <div
          style={{
            position: "absolute",
            top: "18px",
            left: "18px",
            right: "18px",
            bottom: "18px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "20px",
            pointerEvents: "none",
          }}
        />

        {/* Top Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <img
              src={logoBase64}
              alt="Logo Minh Tân Phát"
              style={{
                width: "88px",
                height: "88px",
                borderRadius: "18px",
                boxShadow:
                  "0 10px 25px -5px rgba(234, 88, 12, 0.5), 0 0 0 2px rgba(234, 88, 12, 0.6)",
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    backgroundColor: "#ea580c",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    padding: "5px 14px",
                    borderRadius: "9999px",
                    letterSpacing: "1.2px",
                    textTransform: "uppercase",
                  }}
                >
                  MINH TÂN PHÁT
                </span>
                <span
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    color: "#cbd5e1",
                    fontSize: "14px",
                    padding: "5px 14px",
                    borderRadius: "9999px",
                    fontWeight: 500,
                  }}
                >
                  HỆ THỐNG QUẢN LÝ KHO
                </span>
              </div>
              <span
                style={{
                  fontSize: "17px",
                  color: "#94a3b8",
                  fontWeight: 400,
                }}
              >
                Trang Trại Nuôi Gà Công Nghệ Cao
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              padding: "10px 20px",
              borderRadius: "9999px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 10px #22c55e",
              }}
            />
            <span
              style={{
                fontSize: "16px",
                color: "#f1f5f9",
                fontWeight: 500,
                letterSpacing: "0.5px",
              }}
            >
              minhtanphat.io.vn
            </span>
          </div>
        </div>

        {/* Middle Section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginTop: "6px",
          }}
        >
          <h1
            style={{
              fontSize: "44px",
              fontWeight: 700,
              lineHeight: 1.18,
              margin: 0,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            HỆ THỐNG QUẢN LÝ VẬT TƯ & KHO TRẠI GÀ
          </h1>
          <p
            style={{
              fontSize: "21px",
              lineHeight: 1.45,
              color: "#cbd5e1",
              margin: 0,
              maxWidth: "1020px",
            }}
          >
            Quản lý tồn kho tức thời, lập phiếu yêu cầu xuất/nhập, cấp phát thiết bị, theo dõi tiêu thụ nhiên liệu xe, xử lý hàng hỏng & báo cáo thông minh.
          </p>
        </div>

        {/* Bottom Section */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {[
            { icon: "📦", label: "Tồn Kho & Vật Tư" },
            { icon: "📋", label: "Phiếu Xuất / Nhập" },
            { icon: "⛽", label: "Cấp Phát Nhiên Liệu" },
            { icon: "🔧", label: "Vật Tư Hỏng & Đổi" },
            { icon: "📊", label: "Báo Cáo & Kiểm Kê" },
            { icon: "📱", label: "Quét QR & PWA" },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.07)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "12px",
                padding: "9px 16px",
                fontSize: "15px",
                fontWeight: 500,
                color: "#f1f5f9",
              }}
            >
              <span style={{ fontSize: "17px" }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Roboto",
          data: fontBold,
          weight: 700,
          style: "normal",
        },
        {
          name: "Roboto",
          data: fontRegular,
          weight: 400,
          style: "normal",
        },
      ],
    }
  );
}
