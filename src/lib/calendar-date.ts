/**
 * `TimeEntry.date` is a calendar date, not an instant. It answers "which day did
 * this work happen on" and must read the same for every viewer, so it is stored
 * as UTC midnight of that date. Every server-side bucket (locked period, billing
 * month, range filter, CSV export) reads it with UTC getters and therefore agrees
 * with what the UI shows.
 *
 * `startTime`/`endTime` are genuine instants and are NOT calendar dates - format
 * those in the viewer's local zone instead.
 *
 * Converting an instant to a calendar date needs a timezone; use the firm's.
 */

export const DEFAULT_TIME_ZONE = "America/New_York";

export type DateRangePeriod =
  | "all"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

const CALENDAR_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Reads the calendar date off a "YYYY-MM-DD" or ISO string and returns it as UTC
 * midnight. Any time component is deliberately ignored - callers that need the
 * instant should use startTime/endTime.
 */
export function calendarDateToUtc(value: string): Date {
  const match = CALENDAR_DATE_PREFIX.exec(value.trim());
  if (!match) {
    throw new Error("Invalid calendar date");
  }
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(utc.getTime())) {
    throw new Error("Invalid calendar date");
  }
  return utc;
}

/** Canonical UTC-midnight date -> "YYYY-MM-DD". */
export function utcToCalendarDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function safeTimeZone(timeZone: string | null | undefined) {
  const candidate = timeZone?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return "UTC";
  }
}

/** What calendar date is it, in `timeZone`, at instant `instant`? */
export function calendarDateInTimeZone(instant: Date, timeZone: string | null | undefined): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);

  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${lookup("year")}-${lookup("month")}-${lookup("day")}`;
}

/** The instant's calendar date in `timeZone`, stored the canonical way. */
export function startOfCalendarDayUtc(instant: Date, timeZone: string | null | undefined): Date {
  return calendarDateToUtc(calendarDateInTimeZone(instant, timeZone));
}

/** Inclusive upper bound for range queries against a calendar-date column. */
export function endOfCalendarDayUtc(value: string | Date): Date {
  const start = typeof value === "string" ? calendarDateToUtc(value) : value;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Monday-based, matching the weekStartsOn: 1 the dashboard has always used. */
function startOfUtcWeek(date: Date) {
  const dayOfWeek = date.getUTCDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return addUtcDays(date, -offset);
}

function startOfUtcMonth(date: Date, monthOffset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
}

function endOfUtcMonth(date: Date, monthOffset = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset + 1, 0));
}

/**
 * Shared by the dashboard and both CSV exports so a filter and its export can
 * never disagree. Presets resolve against the firm's calendar day, not the
 * server's.
 */
export function resolveDateRange(
  period: DateRangePeriod,
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined,
  timeZone: string | null | undefined
): { from: Date; to: Date } | null {
  if (period === "all") {
    return null;
  }

  if (period === "custom") {
    if (!dateFrom || !dateTo) {
      return null;
    }
    try {
      return { from: calendarDateToUtc(dateFrom), to: endOfCalendarDayUtc(dateTo) };
    } catch {
      return null;
    }
  }

  const today = calendarDateToUtc(calendarDateInTimeZone(new Date(), timeZone));

  if (period === "this_week" || period === "last_week") {
    const from = startOfUtcWeek(period === "last_week" ? addUtcDays(today, -7) : today);
    return { from, to: endOfCalendarDayUtc(addUtcDays(from, 6)) };
  }

  const monthOffset = period === "last_month" ? -1 : 0;
  return {
    from: startOfUtcMonth(today, monthOffset),
    to: endOfCalendarDayUtc(endOfUtcMonth(today, monthOffset))
  };
}
