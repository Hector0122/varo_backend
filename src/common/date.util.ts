const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parses a user-supplied date. A bare "YYYY-MM-DD" string is anchored at
 * local noon (not midnight) so it can't shift to the previous/next calendar
 * day when later stored/displayed across timezones — `new Date("YYYY-MM-DD")`
 * parses as UTC midnight, which reads as the previous day in any negative
 * UTC-offset timezone. Full ISO datetime strings are parsed as-is.
 */
export function parseDateInput(date: string): Date {
  if (DATE_ONLY_PATTERN.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  return new Date(date);
}
