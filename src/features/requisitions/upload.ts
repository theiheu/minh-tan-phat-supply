// Upload ảnh hóa đơn / chứng từ nhận hàng qua route /api/upload -> server đẩy lên Supabase Storage
const BUCKET = "requisition-images";

export async function uploadRequisitionInvoiceImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("bucket", BUCKET);
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error ?? "Tải ảnh hóa đơn thất bại");
  }
  return data?.url as string;
}
