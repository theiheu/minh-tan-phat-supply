// src/features/catalog/domain/quantity.ts
// Decimal-safe quantity utilities matching PostgreSQL numeric(20,6) semantics.

/**
 * Parse a user-entered string into a positive number, returning null when invalid.
 * Mirrors the SQL _posting_round_base logic by respecting decimal_scale.
 */
export function parseDecimalQuantity(value: string, decimalScale: number = 6): number | null {
  const trimmed = value.trim().replace(",", ".");
  const n = Number(trimmed);
  if (!isFinite(n) || n <= 0) return null;
  const rounded = Math.round(n * 10 ** decimalScale) / 10 ** decimalScale;
  if (decimalScale === 0 && !Number.isInteger(n)) return null;
  return rounded;
}

/** Format number to at most decimalScale digits, stripping trailing zeros. */
export function formatQuantity(value: number, decimalScale: number = 6): string {
  return value.toFixed(decimalScale).replace(/\.?0+$/, "");
}

/** Compute available = onHand - reserved, floored at 0. */
export function computeAvailable(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}
