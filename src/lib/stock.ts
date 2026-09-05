// Pure helpers for stock calculation (mục 15.1).

/**
 * Tồn của variant composite = min(floor(stock(child)/qty)) theo từng linh kiện.
 * Nếu thiếu 1 linh kiện (ratio = 0) → composite = 0.
 */
export function computeCompositeStock(componentStock: number[], quantities: number[]): number {
  if (componentStock.length === 0 || componentStock.length !== quantities.length) return 0;
  const ratios = quantities.map((q, i) => (q > 0 ? Math.floor(componentStock[i] / q) : 0));
  return Math.min(...ratios);
}
