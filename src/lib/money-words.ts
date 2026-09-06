// Đọc số tiền bằng chữ (tiếng Việt) — dòng "Thành tiền bằng chữ" trên phiếu in.
const ONES = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
const TENS = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
const TEENS = ["mười", "mười một", "mười hai", "mười ba", "mười bốn", "mười lăm", "mười sáu", "mười bảy", "mười tám", "mười chín"];

function readThree(n: number, leadZeroHundred = false): string {
  // 0 ≤ n ≤ 999; leadZeroHundred=true khi nhóm nằm giữa <100 → "không trăm lẻ năm".
  if (n === 0) return leadZeroHundred ? "không trăm" : "";
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES[h] + " trăm");
  else if (leadZeroHundred) parts.push("không trăm");
  if (r > 0) {
    if ((h > 0 || leadZeroHundred) && r < 10) parts.push("lẻ");
    if (r < 10) parts.push(ONES[r]);
    else if (r < 20) parts.push(TEENS[r - 10]);
    else {
      const t = Math.floor(r / 10), o = r % 10;
      parts.push(TENS[t]);
      if (o > 0) {
        if (o === 1) parts.push("mốt");
        else if (o === 4) parts.push("tư");
        else if (o === 5) parts.push("lăm");
        else parts.push(ONES[o]);
      }
    }
  }
  return parts.join(" ");
}

const SCALE = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

export function formatAmountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  const n = Math.round(amount);
  if (n === 0) return "không đồng";
  const groups: number[] = [];
  let x = n;
  while (x > 0) { groups.push(x % 1000); x = Math.floor(x / 1000); }
  const firstNonZero = groups.length - 1; // nhóm cao nhất có giá trị (groups cuối > 0)
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    // Nhóm giữa (< 100, không phải nhóm cao nhất) phải đọc "không trăm lẻ …"
    const needZeroHundred = i < firstNonZero && g < 100;
    const word = readThree(g, needZeroHundred);
    parts.push(`${word} ${SCALE[i]}`.trim());
  }
  return `${parts.join(" ")} đồng`;
}
