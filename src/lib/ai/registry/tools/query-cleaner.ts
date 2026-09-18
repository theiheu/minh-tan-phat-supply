/**
 * Làm sạch từ khóa tìm kiếm tiếng Việt do LLM hoặc người dùng truyền vào.
 * Loại bỏ các tiền tố / hậu tố giao tiếp (ví dụ: "tra cứu tồn kho thực tế của", "ở các kho",...).
 */
export function cleanSearchQuery(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim();

  // Loại bỏ dấu nháy hoặc backtick bọc ngoài
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();

  const prefixes = [
    /^tra\s+cứu\s+(tồn\s+kho\s+)?(thực\s+tế\s+)?(của\s+)?(các\s+loại\s+)?/i,
    /^kiểm\s+tra\s+(tồn\s+kho\s+)?(của\s+)?(các\s+loại\s+)?/i,
    /^xem\s+(tồn\s+kho\s+)?(của\s+)?(các\s+loại\s+)?/i,
    /^tìm\s+(kiếm\s+)?(vật\s+tư\s+|sản\s+phẩm\s+)?(của\s+)?/i,
    /^lấy\s+danh\s+sách\s+(tất\s+cả\s+)?(tồn\s+kho\s+)?(để\s+kiểm\s+tra\s+)?/i,
    /^thông\s+tin\s+(về\s+)?/i,
    /^báo\s+cáo\s+(về\s+)?/i,
    /^danh\s+sách\s+(các\s+)?/i,
  ];

  for (const p of prefixes) {
    s = s.replace(p, "").trim();
  }

  const suffixes = [
    /\s+(ở|tại)\s+các\s+kho\s+hiện\s+tại\.?$/i,
    /\s+(ở|tại)\s+các\s+kho\.?$/i,
    /\s+(ở|tại)\s+kho\.?$/i,
    /\s+trong\s+kho\.?$/i,
    /\s+hiện\s+tại\.?$/i,
    /\s+thực\s+tế\.?$/i,
  ];

  for (const suf of suffixes) {
    s = s.replace(suf, "").trim();
  }

  return s || raw.trim();
}
