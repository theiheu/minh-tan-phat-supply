// Định dạng số/tiền/ngày theo quy ước in (mục 18.1): 1.234.567 đ, dd/mm/yyyy.

const vnd = new Intl.NumberFormat("vi-VN");

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "0";
  return vnd.format(value);
}

export function formatVnd(value: number | null | undefined): string {
  if (value == null) return "0 đ";
  return `${vnd.format(value)} đ`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Ngày + giờ "dd/mm/yyyy HH:mm" — dùng cho timeline/lịch sử cần phân biệt nhiều mốc cùng ngày.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}

// in theo múi giờ máy chủ (mặc định +07, như formatDate)
export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `Ngày ${String(d.getDate()).padStart(2, "0")} tháng ${String(d.getMonth() + 1).padStart(2, "0")} năm ${d.getFullYear()}`;
}

// Khoảng ngày "YYYY-MM-DD" (múi giờ VN +07:00) → ISO UTC cho filter created_at.
export function dayRange(from: string | null, to: string | null): { gte?: string; lte?: string } {
  const range: { gte?: string; lte?: string } = {};
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (from && DATE_RE.test(from)) range.gte = new Date(`${from}T00:00:00+07:00`).toISOString();
  if (to && DATE_RE.test(to)) range.lte = new Date(`${to}T23:59:59+07:00`).toISOString();
  return range;
}
