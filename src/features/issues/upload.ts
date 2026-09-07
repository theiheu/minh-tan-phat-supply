// Upload ảnh hóa đơn / chứng từ của phiếu xuất kho qua route /api/upload
const BUCKET = "issue-images";

export async function uploadIssueInvoiceImage(file: File): Promise<string> {
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
