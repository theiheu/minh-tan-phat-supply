import type { NextConfig } from "next";

// Tự suy host ảnh storage từ NEXT_PUBLIC_SUPABASE_URL để ảnh hoạt động ở cả
// local (127.0.0.1/localhost) lẫn self-host (domain VPS) và Supabase hosted (*.supabase.co).
function supabaseStoragePatterns(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  const patterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
    // Local Supabase storage (dev)
    { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/**" },
    { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/object/**" },
    // Supabase hosted project storage (production cloud)
    { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
    // Domain production
    { protocol: "https", hostname: "minhtanphat.io.vn", pathname: "/**" },
    { protocol: "http", hostname: "minhtanphat.io.vn", pathname: "/**" },
    // Unsplash (placeholder / seed / mock images)
    { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      const isLocal = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
      patterns.push({
        protocol: isLocal ? "http" : "https",
        hostname: parsed.hostname,
        ...(parsed.port ? { port: parsed.port } : {}),
        pathname: "/storage/v1/object/**",
      });
    } catch {
      // Bỏ qua URL không hợp lệ (env chưa set hoặc sai định dạng).
    }
  }

  return patterns;
}

const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https: http:;
    font-src 'self' data:;
    connect-src 'self' ws: wss: http: https:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: cspHeader },
];

const nextConfig: NextConfig = {
  // Cho phép build ra thư mục riêng (deploy.sh build .next-new, không đụng .next đang chạy).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Bật nén Gzip/Brotli để giảm kích thước truyền tải tài nguyên
  compress: true,
  // Tắt header X-Powered-By để bảo mật và tiết kiệm byte
  poweredByHeader: false,
  // Tối ưu tree-shaking và chia nhỏ chunk các thư viện lớn
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tanstack/react-query",
      "radix-ui",
      "sonner",
      "exceljs",
      "xlsx",
      "date-fns",
    ],
  },
  images: {
    remotePatterns: supabaseStoragePatterns(),
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  // Cache headers cho static assets và Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/brand/:all*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icons/:all*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/fonts/:all*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  // Proxy Supabase endpoints qua server app (cùng nguồn) — trình duyệt không cần truy cập
  // thẳng Supabase (127.0.0.1:54321), tránh lỗi mixed content / CORS khi ở xa.
  async rewrites() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    if (!supabaseUrl) return [];
    return [
      { source: "/storage/:path*", destination: `${supabaseUrl}/storage/:path*` },
      { source: "/auth/:path*", destination: `${supabaseUrl}/auth/:path*` },
      { source: "/rest/:path*", destination: `${supabaseUrl}/rest/:path*` },
    ];
  },
};

export default nextConfig;
