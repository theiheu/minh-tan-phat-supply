import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Bucket cho phép nhận file (đổi tên nguồn nếu cần bucket mới ở đây).
const ALLOWED_BUCKETS = new Set(["product-images", "category-icons", "defect-images"]);
const ALLOWED_TYPES = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);
const MAX_SIZE = 8 * 1024 * 1024; // 8MB

/**
 * Upload ảnh qua server (cùng nguồn với app) để tránh trình duyệt fetch thẳng tới
 * Supabase (dễ fail vì CORS/mạng). Client gửi multipart: bucket + file.
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
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Chưa chọn file" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Ảnh quá lớn (tối đa 8MB)" }, { status: 400 });
    }

    const ext = ALLOWED_TYPES.get(file.type);
    if (!ext) {
      return NextResponse.json(
        { error: "Chỉ chấp nhận ảnh PNG, JPG hoặc WebP" },
        { status: 400 },
      );
    }

    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
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
