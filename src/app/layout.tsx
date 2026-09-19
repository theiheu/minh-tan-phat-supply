import type { Metadata, Viewport } from "next";
import "./globals.css";
import NextTopLoader from "nextjs-toploader";
import { Providers } from "@/components/providers";
import { MobileInstallPrompt } from "@/components/layout/mobile-install-prompt";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://minhtanphat.io.vn";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Quản lý Kho Trại Gà Minh Tân Phát",
    template: "%s | Kho MTP",
  },
  description:
    "Hệ thống quản lý vật tư & kho trại gà Minh Tân Phát: xuất nhập kho, cấp phát thiết bị, theo dõi tiêu thụ nhiên liệu xe, vật tư hỏng, kiểm kê và báo cáo phân tích thông minh.",
  applicationName: "Kho MTP",
  authors: [{ name: "Trại Gà Minh Tân Phát" }],
  generator: "Next.js",
  keywords: [
    "Minh Tân Phát",
    "Trại gà Minh Tân Phát",
    "Quản lý kho",
    "Quản lý vật tư",
    "Kho MTP",
    "Nhiên liệu",
    "Vật tư trại gà",
    "Xuất nhập kho",
    "Kiểm kê kho",
  ],
  referrer: "origin-when-cross-origin",
  creator: "Minh Tân Phát",
  publisher: "Minh Tân Phát",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: "Kho Trại Gà Minh Tân Phát",
    title: "Quản lý Kho Trại Gà Minh Tân Phát",
    description:
      "Hệ thống quản lý vật tư & kho trại gà Minh Tân Phát: xuất nhập kho, cấp phát thiết bị, theo dõi tiêu thụ nhiên liệu xe, vật tư hỏng, kiểm kê và báo cáo phân tích thông minh.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Quản lý Kho Trại Gà Minh Tân Phát - Hệ thống quản lý vật tư",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quản lý Kho Trại Gà Minh Tân Phát",
    description:
      "Hệ thống quản lý vật tư & kho trại gà Minh Tân Phát: xuất nhập kho, cấp phát thiết bị, theo dõi tiêu thụ nhiên liệu xe, vật tư hỏng, kiểm kê và báo cáo phân tích thông minh.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/brand/logo.png", sizes: "any", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/brand/logo.png", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kho MTP",
  },
  other: {
    "og:image:width": "1200",
    "og:image:height": "630",
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <NextTopLoader
          color="#ea580c"
          initialPosition={0.12}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #ea580c,0 0 5px #ea580c"
          zIndex={99999}
        />
        <Providers>
          {children}
          <MobileInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
