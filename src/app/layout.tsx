import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { MobileInstallPrompt } from "@/components/layout/mobile-install-prompt";

export const metadata: Metadata = {
  title: "Quản lý Kho Trại Gà Minh Tân Phát",
  description: "Hệ thống quản lý vật tư trại gà: tồn kho, phiếu yêu cầu, nhập kho, vật tư hỏng, kiểm kê, báo cáo.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kho MTP",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {children}
          <MobileInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
