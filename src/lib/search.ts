/**
 * Chuẩn hóa tiếng Việt: loại bỏ dấu, chuyển về chữ thường, xóa ký tự đặc biệt thừa.
 * Hỗ trợ tìm kiếm không dấu / có dấu / viết tắt.
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  let text = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Thay thế các ký tự Đ/đ
  text = text.replace(/[đĐ]/g, (m) => (m === "đ" ? "d" : "D"));
  return text;
}

/**
 * Chuẩn hóa chuỗi tìm kiếm thành dạng lowercase không dấu.
 */
export function normalizeSearchText(str: string): string {
  if (!str) return "";
  return removeVietnameseTones(str).toLowerCase().trim();
}

/**
 * Tách chuỗi truy vấn thành danh sách các từ khóa (tokens).
 */
export function tokenizeQuery(query: string): string[] {
  if (!query) return [];
  return normalizeSearchText(query)
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Kiểm tra xem chuỗi đích (target) có chứa TẤT CẢ các từ khóa trong chuỗi tìm kiếm (query) hay không.
 * Không phân biệt dấu tiếng Việt và hoa/thường.
 */
export function matchesSearchTokens(target: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const normalizedTarget = normalizeSearchText(target);
  const tokens = tokenizeQuery(query);

  if (tokens.length === 0) return true;
  return tokens.every((token) => normalizedTarget.includes(token));
}

/**
 * Tính điểm khớp cho kết quả tìm kiếm (càng cao càng chính xác):
 * - 100: Trùng khớp chính xác tuyệt đối
 * - 90: Trùng khớp chính xác không dấu
 * - 80: Bắt đầu bằng từ khóa
 * - 70: Bắt đầu bằng từ khóa (không dấu)
 * - 60: Chứa trọn vẹn cụm từ
 * - 50: Chứa trọn vẹn cụm từ (không dấu)
 * - 40: Chứa tất cả các từ đơn lẻ (tokens)
 * - 0: Không khớp
 */
export function computeSearchScore(target: string, query: string, code?: string | null): number {
  if (!query || !query.trim()) return 10;
  if (!target) return 0;

  const qRaw = query.trim().toLowerCase();
  const tRaw = target.trim().toLowerCase();

  // Khớp chính xác mã code
  if (code && code.trim().toLowerCase() === qRaw) return 100;

  // Khớp chính xác có dấu
  if (tRaw === qRaw) return 100;

  const qNorm = normalizeSearchText(query);
  const tNorm = normalizeSearchText(target);

  // Khớp chính xác không dấu
  if (tNorm === qNorm) return 90;

  // Bắt đầu bằng chuỗi tìm kiếm
  if (tRaw.startsWith(qRaw)) return 80;
  if (tNorm.startsWith(qNorm)) return 70;

  // Chứa trọn vẹn cụm từ
  if (tRaw.includes(qRaw)) return 60;
  if (tNorm.includes(qNorm)) return 50;

  // Chứa tất cả tokens
  const tokens = tokenizeQuery(query);
  if (tokens.length > 0 && tokens.every((token) => tNorm.includes(token))) {
    return 40;
  }

  return 0;
}
