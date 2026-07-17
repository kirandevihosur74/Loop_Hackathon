/**
 * Date helpers for the Schedule screen. DayForecast.date is an ISO `YYYY-MM-DD`
 * string produced from `Date.toISOString()` (UTC). We parse those parts into a
 * LOCAL date so weekday alignment and labels don't drift by a day across
 * timezones — always via these helpers, never `new Date("YYYY-MM-DD")`.
 */

/** Parse an ISO `YYYY-MM-DD` into a local Date at midnight (no UTC shift). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Short weekday label, e.g. "Thu". */
export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[parseISODate(iso).getDay()];
}

/** Full weekday label, e.g. "Thursday". */
export function weekdayLong(iso: string): string {
  return WEEKDAY_LONG[parseISODate(iso).getDay()];
}

/** Day-of-month number, e.g. 17. */
export function dayOfMonth(iso: string): number {
  return parseISODate(iso).getDate();
}

/** Zero-based weekday index (0 = Sunday) — used to pad the month grid. */
export function weekdayIndex(iso: string): number {
  return parseISODate(iso).getDay();
}

/** Format a USD amount as `$4.20` (or `$0` for zero). */
export function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}
