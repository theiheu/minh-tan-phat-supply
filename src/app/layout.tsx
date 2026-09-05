import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "Quản lý Kho Trại Gà Minh Tân Phát",
  description: "Hệ thống quản lý vật tư trại gà: tồn kho, phiếu yêu cầu, nhập kho, vật tư hỏng, kiểm kê, báo cáo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
