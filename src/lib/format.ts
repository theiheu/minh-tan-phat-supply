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
