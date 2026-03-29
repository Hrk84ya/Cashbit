/**
 * Format a monetary string value for display using the Indian English locale.
 * Accepts the string representation returned by the API (Decimal serialized as string)
 * and returns a locale-formatted currency string, e.g. "₹1,23,456.78".
 */
export function formatMoney(value: string, currency = 'INR'): string {
  const num = parseFloat(value);
  if (Number.isNaN(num)) return value;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
