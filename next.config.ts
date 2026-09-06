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

const nextConfig: NextConfig = {
  // Cho phép build ra thư mục riêng (deploy.sh build .next-new, không đụng .next đang chạy).
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: supabaseStoragePatterns(),
  },
  // Proxy ảnh storage qua server app (cùng nguồn) — trình duyệt không cần truy cập
  // thẳng Supabase (127.0.0.1:54321), tránh lỗi ảnh không hiện khi ở máy/xa khác.
  async rewrites() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
    if (!supabaseUrl) return [];
    return [{ source: "/storage/:path*", destination: `${supabaseUrl}/storage/:path*` }];
  },
};

export default nextConfig;
