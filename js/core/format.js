// @ts-check
// Number, money and date formatting for the screen and the PDFs.
// Rounding happens here only, never in the calculation.

const amountFormat = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const moneyFormat = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Shown in the Packages column when an ingredient has no package size or price. */
export const NO_PACKAGE_SIZE_TEXT = "-";

/**
 * @param {number} value
 * @returns {string}
 */
export function formatAmount(value) {
  return amountFormat.format(value);
}

/**
 * @param {number} value
 * @returns {string}
 */
export function formatMoney(value) {
  return moneyFormat.format(value);
}

/**
 * Share of a whole as a rounded percentage, e.g. "90 %".
 * @param {number} part
 * @param {number} whole
 * @returns {string}
 */
export function formatPercent(part, whole) {
  return `${Math.round((part / whole) * 100)} %`;
}

/**
 * Formats a "YYYY-MM-DD" string as a long date, e.g. "Saturday, 14 June 2025".
 * The date is built locally, so no time zone shift happens.
 * @param {string} value
 * @returns {string}
 */
export function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return dateFormat.format(new Date(year, month - 1, day));
}
