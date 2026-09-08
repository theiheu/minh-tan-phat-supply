import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processImageUpload } from "@/lib/server-image";

// Bucket cho phép nhận file (đổi tên nguồn nếu cần bucket mới ở đây).
const ALLOWED_BUCKETS = new Set([
  "product-images",
  "category-icons",
  "defect-images",
  "receipt-images",
  "issue-images",
]);
const MAX_SIZE = 20 * 1024 * 1024; // 20MB (hỗ trợ ảnh độ phân giải cao từ điện thoại)

/**
 * Upload ảnh qua server (cùng nguồn với app) để tránh trình duyệt fetch thẳng tới
 * Supabase (dễ fail vì CORS/mạng). Client gửi multipart: bucket + file.
 * Tự động chuyển đổi ảnh định dạng HEIC/HEIF sang JPEG để hiển thị tương thích 100% trên mọi trình duyệt.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
    }

    const bucket = String(form.get("bucket") ?? "");
    if (!ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: "Bucket không hợp lệ" }, { status: 400 });
    }

    const file = form.get("file");
    if (
      !file ||
      typeof file === "string" ||
      typeof (file as Blob).arrayBuffer !== "function" ||
      (file as Blob).size === 0
    ) {
      return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
    }

    const fileSize = (file as Blob).size;
    if (fileSize > MAX_SIZE) {
      return NextResponse.json({ error: "Ảnh quá lớn (tối đa 20MB)" }, { status: 400 });
    }

    const fileName = "name" in file && typeof (file as { name: unknown }).name === "string"
      ? (file as { name: string }).name
      : "";
    const fileType = "type" in file && typeof (file as { type: unknown }).type === "string"
      ? (file as { type: string }).type
      : "";

    let processed;
    try {
      const arrayBuffer = await (file as Blob).arrayBuffer();
      processed = await processImageUpload(new Uint8Array(arrayBuffer), fileType, fileName);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Định dạng file không được hỗ trợ" },
        { status: 400 },
      );
    }

    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${processed.ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, processed.data, {
      contentType: processed.contentType,
    });
    if (error) {
      return NextResponse.json(
        { error: `Tải ảnh thất bại: ${error.message}` },
        { status: 500 },
      );
    }

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl.publicUrl });
  } catch {
    return NextResponse.json({ error: "Tải ảnh thất bại, vui lòng thử lại" }, { status: 500 });
  }
}
