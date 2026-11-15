import { formatInTimeZone } from 'date-fns-tz';

/** The calendar day (YYYY-MM-DD) it currently is in the given IANA timezone. */
export function todayIn(timezone: string, now: Date): string {
  return formatInTimeZone(now, timezone, 'yyyy-MM-dd');
}
