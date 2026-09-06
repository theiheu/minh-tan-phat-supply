// Chuyển URL ảnh storage tuyệt đối (VD http://127.0.0.1:54321/storage/...) về đường
// dẫn CÙNG NGUỒN (/storage/...) để trình duyệt tải qua server app — rewrite trong
// next.config sẽ proxy tới Supabase. Trình duyệt không cần truy cập Supabase trực tiếp.
export function appAssetUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("/")) return src;
  try {
    const u = new URL(src);
    if (u.pathname.startsWith("/storage/")) {
      return u.pathname + u.search;
    }
  } catch {
    // data:, blob: ... — giữ nguyên.
  }
  return src;
}
