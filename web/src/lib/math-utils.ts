/**
 * Math utility functions.
 */

/**
 * Calculate percentage change between latest and reference value.
 * Returns null if values are invalid or reference is zero.
 */
export function pctChange(latest: number, ref: number | null | undefined): number | null {
  if (!ref || ref <= 0 || !isFinite(ref)) return null
  if (!isFinite(latest)) return null
  return ((latest - ref) / ref) * 100
}

