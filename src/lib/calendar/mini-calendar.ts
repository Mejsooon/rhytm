import { addDays, addMonths, format, getISOWeek, parseISO, startOfISOWeek, startOfMonth } from 'date-fns';
import { pl } from 'date-fns/locale';

export type MiniDay = { date: string; day: number; inMonth: boolean };
export type MiniWeek = { week: number; days: MiniDay[] };
export type MiniHighlight = { kind: 'week'; from: string; to: string } | { kind: 'day'; date: string } | null;

const DATE_FORMAT = 'yyyy-MM-dd';

/** 6 wierszy po 7 dni, od poniedziałku; `month` to 'YYYY-MM'. */
export function miniCalendarWeeks(month: string): MiniWeek[] {
  const first = startOfMonth(parseISO(`${month}-01`));
  const gridStart = startOfISOWeek(first);
  return Array.from({ length: 6 }, (_, row) => {
    const rowStart = addDays(gridStart, row * 7);
    return {
      week: getISOWeek(rowStart),
      days: Array.from({ length: 7 }, (_, col) => {
        const d = addDays(rowStart, col);
        return {
          date: format(d, DATE_FORMAT),
          day: d.getDate(),
          inMonth: d.getMonth() === first.getMonth(),
        };
      }),
    };
  });
}

/** Co podświetlić w mini kalendarzu dla widoku głównego kalendarza. */
export function miniHighlight(
  viewType: 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth',
  currentStart: string,
): MiniHighlight {
  if (viewType === 'timeGridDay') return { kind: 'day', date: currentStart };
  if (viewType === 'timeGridWeek') {
    return { kind: 'week', from: currentStart, to: format(addDays(parseISO(currentStart), 6), DATE_FORMAT) };
  }
  return null;
}

/** „Listopad 2026”. */
export function miniMonthTitle(month: string): string {
  const title = format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: pl });
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Przesuwa 'YYYY-MM' o `delta` miesięcy. */
export function shiftMonth(month: string, delta: number): string {
  return format(addMonths(parseISO(`${month}-01`), delta), 'yyyy-MM');
}

/** „18 listopada 2026” — do aria-label. */
export function miniDayLabel(date: string): string {
  return format(parseISO(date), 'd MMMM yyyy', { locale: pl });
}

/**
 * Tytuł okresu nad kalendarzem dla widoku i jego pierwszego dnia ('YYYY-MM-DD'):
 * „Środa, 18 listopada 2026”, „16 – 22 lis 2026 · tydzień 47”, „Listopad 2026”.
 */
export function periodTitle(
  viewType: 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth',
  currentStart: string,
): string {
  const start = parseISO(currentStart);
  if (viewType === 'dayGridMonth') return miniMonthTitle(currentStart.slice(0, 7));
  if (viewType === 'timeGridDay') {
    const day = format(start, 'EEEE, d MMMM yyyy', { locale: pl });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  const end = addDays(start, 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const from = format(start, sameMonth ? 'd' : sameYear ? 'd MMM' : 'd MMM yyyy', { locale: pl });
  const to = format(end, 'd MMM yyyy', { locale: pl });
  return `${from} – ${to} · tydzień ${getISOWeek(start)}`;
}
