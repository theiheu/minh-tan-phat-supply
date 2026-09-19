// Upload ảnh giấy tờ xe qua route /api/upload -> server đẩy lên Supabase Storage
const BUCKET = "vehicle-documents";

export async function uploadVehicleDocumentImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("bucket", BUCKET);
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Tải ảnh giấy tờ xe thất bại");
  }
  return data?.url as string;
}
