import { config } from '../config';

/**
 * Interprets a date string without timezone as IST and converts to UTC.
 * If the string already has a timezone offset, it is parsed as-is.
 *
 * Examples:
 *   "2026-03-15" → interpreted as 2026-03-15T00:00:00+05:30 → UTC: 2026-03-14T18:30:00.000Z
 *   "2026-03-15T10:00:00" → interpreted as 2026-03-15T10:00:00+05:30 → UTC: 2026-03-15T04:30:00.000Z
 *   "2026-03-15T10:00:00Z" → kept as-is (already has timezone)
 */
export function dateToUTC(dateStr: string): Date {
  // If the string already contains a timezone indicator (Z, +, or - after time), parse directly
  if (/[Zz]$/.test(dateStr) || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // For date-only strings like "2026-03-15", interpret as midnight IST
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T00:00:00${config.IST_OFFSET}`);
  }

  // For datetime strings without timezone, append IST offset
  return new Date(`${dateStr}${config.IST_OFFSET}`);
}

/**
 * Returns the UTC start and end dates for a given IST month.
 *
 * For month "2026-03":
 *   start = 2026-03-01T00:00:00+05:30 → 2026-02-28T18:30:00.000Z
 *   end   = 2026-04-01T00:00:00+05:30 → 2026-03-31T18:30:00.000Z
 *
 * Usage: WHERE date >= start AND date < end
 */
export function getISTMonthRange(monthYear: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based

  const start = new Date(`${yearStr}-${monthStr.padStart(2, '0')}-01T00:00:00${config.IST_OFFSET}`);

  // Next month: handle December → January rollover
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00${config.IST_OFFSET}`,
  );

  return { start, end };
}
