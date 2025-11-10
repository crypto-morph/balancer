/**
 * Time utility constants and helpers for time calculations.
 */

export const ONE_HOUR_MS = 60 * 60 * 1000
export const ONE_DAY_MS = 24 * ONE_HOUR_MS

/**
 * Convert days to milliseconds.
 */
export const days = (n: number) => n * ONE_DAY_MS

