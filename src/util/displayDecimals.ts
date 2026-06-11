export const DEFAULT_DISPLAY_DECIMALS = 5;
export const MIN_DISPLAY_DECIMALS = 0;
export const MAX_DISPLAY_DECIMALS = 10;

export function clampDisplayDecimals(dp: number): number {
  if (!Number.isFinite(dp)) return DEFAULT_DISPLAY_DECIMALS;
  return Math.max(
    MIN_DISPLAY_DECIMALS,
    Math.min(MAX_DISPLAY_DECIMALS, Math.round(dp))
  );
}

export function roundValue(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const order = 10 ** clampDisplayDecimals(dp);
  return Math.round(value * order) / order;
}

/** Format a numeric value rounded to `dp` decimal places (trailing zeros trimmed). */
export function formatValue(value: number, dp: number): string {
  const rounded = roundValue(value, dp);
  if (clampDisplayDecimals(dp) === 0) return String(rounded);
  return rounded.toFixed(clampDisplayDecimals(dp)).replace(/\.?0+$/, "");
}
