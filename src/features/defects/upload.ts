// Upload ảnh vật tư hỏng qua route /api/upload (cùng nguồn app).
const BUCKET = "defect-images";

export async function uploadDefectImage(file: File): Promise<string> {
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
