// Quy tắc tên đăng nhập: chữ thường a-z, số, . _ - ; 3-30 ký tự; không dấu;
// bắt đầu bằng chữ cái. Lưu luôn dạng lowercase (chuẩn hoá khi tạo/sửa).
export const USERNAME_RE = /^[a-z][a-z0-9._-]{2,29}$/;

export const EMAIL_DOMAIN = "mtp.local";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_RE.test(normalizeUsername(raw));
}

// Email nội bộ cho Supabase Auth (ẩn khỏi UI). Tài khoản cũ giữ email thật.
export function internalEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`;
}
