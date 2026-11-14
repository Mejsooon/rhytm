import { formatInTimeZone } from 'date-fns-tz';
import type { BlockChange } from './plan-edit';
import type { BlockSeries, Occurrence, Recurrence, Weekday } from './types';

export type RepeatMode = 'none' | 'daily' | 'weekdays' | 'weekly' | 'custom';

/** Stan formularza bloku. Daty i godziny są lokalne (w strefie z profilu). */
export type BlockFormValue = {
  title: string;
  color: string;
  note: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // 'HH:mm'
  endTime: string; // 'HH:mm'
  repeat: RepeatMode;
  weekdays: Weekday[]; // tylko dla repeat === 'custom'
  until: string; // 'YYYY-MM-DD' albo '' (bez końca)
};

const LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

/** Lokalny napis 'YYYY-MM-DDTHH:mm' dla chwili w strefie `timezone`. */
export function toLocalString(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, LOCAL_FORMAT);
}

/** Najbliższa pełna godzina (bez zmiany, gdy jest już pełna) jako lokalny napis w strefie. */
export function nextFullHour(now: Date, timezone: string): string {
  const local = toLocalString(now, timezone);
  if (local.endsWith(':00')) return local;
  // Arytmetyka na napisie jak na UTC, żeby nie zależeć od strefy przeglądarki.
  const next = new Date(`${local.slice(0, 13)}:00:00Z`).getTime() + 3_600_000;
  return new Date(next).toISOString().slice(0, 16);
}

/** Pusty formularz dla zakresu lokalnych napisów (zaznaczenie w kalendarzu lub przycisk „+”). */
export function emptyBlockForm(startLocal: string, durationMin: number): BlockFormValue {
  const startMs = new Date(`${startLocal}:00Z`).getTime();
  const end = new Date(startMs + durationMin * 60_000).toISOString();
  return {
    title: '',
    color: 'blue',
    note: '',
    date: startLocal.slice(0, 10),
    startTime: startLocal.slice(11, 16),
    // Koniec po północy zostaje przycięty do 23:59 (bloki nie przechodzą przez północ w formularzu).
    endTime: end.slice(0, 10) === startLocal.slice(0, 10) ? end.slice(11, 16) : '23:59',
    repeat: 'none',
    weekdays: [],
    until: '',
  };
}

/** Formularz edycji wypełniony z wystąpienia (powtarzanie nie jest edytowane z wystąpienia). */
export function blockFormFromOccurrence(o: Occurrence, timezone: string): BlockFormValue {
  const start = toLocalString(o.start, timezone);
  const end = toLocalString(o.end, timezone);
  return {
    title: o.title,
    color: o.color,
    note: o.note ?? '',
    date: start.slice(0, 10),
    startTime: start.slice(11, 16),
    endTime: end.slice(0, 10) === start.slice(0, 10) ? end.slice(11, 16) : '23:59',
    repeat: 'none',
    weekdays: [],
    until: '',
  };
}

/** Czas trwania w minutach z pól godzin; rzuca błąd z polskim komunikatem, gdy koniec nie jest po początku. */
export function formDurationMin(value: Pick<BlockFormValue, 'startTime' | 'endTime'>): number {
  const [sh, sm] = value.startTime.split(':').map(Number);
  const [eh, em] = value.endTime.split(':').map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  if (!Number.isFinite(minutes) || minutes < 5) {
    throw new Error('Koniec musi być co najmniej 5 minut po początku');
  }
  return minutes;
}

/** Powtarzanie z formularza; rzuca błąd, gdy wybrano „Wybrane dni” bez żadnego dnia. */
export function formToRecurrence(value: Pick<BlockFormValue, 'repeat' | 'weekdays' | 'until'>): Recurrence | null {
  if (value.repeat === 'none') return null;
  const until = value.until === '' ? {} : { until: value.until };
  if (value.repeat === 'custom') {
    if (value.weekdays.length === 0) throw new Error('Wybierz co najmniej jeden dzień tygodnia');
    return { freq: 'custom', byWeekday: [...value.weekdays].sort(), ...until };
  }
  return { freq: value.repeat, ...until };
}

/** Wejście `createBlock` z formularza (strefę dopisuje serwer z profilu). */
export function formToNewBlock(value: BlockFormValue): Omit<BlockSeries, 'id' | 'timezone'> {
  const title = value.title.trim();
  if (title === '') throw new Error('Podaj nazwę bloku');
  return {
    title,
    color: value.color,
    note: value.note.trim() === '' ? null : value.note.trim(),
    startLocal: `${value.date}T${value.startTime}`,
    durationMin: formDurationMin(value),
    recurrence: formToRecurrence(value),
  };
}

/** Zmiana dla `editBlock`/`previewEdit` z formularza edycji (bez powtarzania). */
export function formToChange(value: BlockFormValue): BlockChange {
  const title = value.title.trim();
  if (title === '') throw new Error('Podaj nazwę bloku');
  return {
    title,
    color: value.color,
    note: value.note.trim() === '' ? null : value.note.trim(),
    startLocal: `${value.date}T${value.startTime}`,
    durationMin: formDurationMin(value),
  };
}
