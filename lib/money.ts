/**
 * Format integer cents as KES currency string.
 * 150000 → "KES 1,500"
 */
export function formatKES(cents: number): string {
  const kes = cents / 100
  return `KES ${kes.toLocaleString("en-KE")}`
}

/**
 * Convert KES input (as number) to integer cents.
 * 1500 → 150000
 */
export function toCents(kes: number): number {
  return Math.round(kes * 100)
}

/**
 * Parse a user-entered string to cents.
 * Handles commas, dots, and whitespace.
 * "1,500" → 150000
 */
export function parseKESInput(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const num = parseFloat(cleaned)
  if (isNaN(num) || num < 0) return null
  return Math.round(num * 100)
}

/**
 * Convert cents to KES number (for display in forms).
 * 150000 → 1500
 */
export function centsToKES(cents: number): number {
  return cents / 100
}
