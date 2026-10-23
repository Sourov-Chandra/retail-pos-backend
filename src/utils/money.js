/**
 * Money Utility for Bangladeshi Taka (BDT, ৳)
 * All monetary amounts are stored internally as integer minor units (poisha).
 * 1 BDT = 100 poisha (minor units).
 * Example: ৳180.00 is stored as 18000.
 */

/**
 * Converts a decimal major unit amount (e.g., 180.50) to integer minor units (18050).
 * Uses Math.round to avoid IEEE 754 floating point inaccuracies.
 * @param {number|string} amount 
 * @returns {number} Integer minor units
 */
export function toMinorUnits(amount) {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numericAmount) || numericAmount < 0) {
    throw new Error("Invalid monetary amount. Must be a non-negative number.");
  }
  return Math.round(numericAmount * 100);
}

/**
 * Converts integer minor units (18050) to decimal major units (180.50).
 * @param {number} minorUnits 
 * @returns {number}
 */
export function toMajorUnits(minorUnits) {
  if (typeof minorUnits !== "number" || isNaN(minorUnits)) {
    throw new Error("Invalid minor units. Must be a number.");
  }
  return minorUnits / 100;
}

/**
 * Formats minor units into BDT currency string (e.g., 18000 -> "৳180.00").
 * @param {number} minorUnits 
 * @returns {string}
 */
export function formatBDT(minorUnits) {
  const major = toMajorUnits(minorUnits);
  return `৳${major.toFixed(2)}`;
}
