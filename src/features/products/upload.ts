// Upload ảnh vật tư qua route /api/upload (cùng nguồn app) → server đẩy lên Supabase
// Storage. Tránh trình duyệt fetch thẳng tới Supabase (lỗi CORS/mạng "Failed to fetch").
const BUCKET = "product-images";

export async function uploadProductImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("bucket", BUCKET);
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Tải ảnh thất bại");
  }
  return data?.url as string;
}
