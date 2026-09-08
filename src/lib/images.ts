import { isSuperuser } from "@/lib/types";

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

/**
 * Kiểm tra xem người dùng hiện tại có quyền xoá một ảnh hoá đơn/chứng từ hay không.
 * - Tài khoản Dev (superuser): toàn quyền xoá mọi ảnh.
 * - Tài khoản thường: chỉ được xoá ảnh do chính mình tải lên (URL chứa user id của mình,
 *   hoặc ảnh cũ chưa có folder user id nhưng mình là người tạo phiếu).
 */
export function canDeleteInvoiceImage({
  imageUrl,
  currentUserId,
  userRole,
  creatorId,
}: {
  imageUrl: string;
  currentUserId?: string | null;
  userRole?: string | null;
  creatorId?: string | null;
}): boolean {
  if (isSuperuser(userRole)) return true;
  if (!currentUserId) return false;

  // Nếu URL chứa ID của người dùng hiện tại
  if (imageUrl.includes(currentUserId)) return true;

  // Nếu là ảnh cũ chưa có tiền tố UUID của bất kỳ user nào trong path,
  // và người dùng hiện tại chính là người tạo phiếu
  const hasAnyUuidFolder =
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(imageUrl) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(imageUrl);

  if (!hasAnyUuidFolder && creatorId && creatorId === currentUserId) {
    return true;
  }

  return false;
}
