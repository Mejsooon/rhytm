import type { Database, Json } from '@/lib/db/types';
import type { BlockException, BlockSeries, Recurrence } from './types';

type BlockRow = Database['public']['Tables']['blocks']['Row'];
type BlockInsert = Database['public']['Tables']['blocks']['Insert'];
type ExceptionRow = Database['public']['Tables']['block_exceptions']['Row'];

/** Wiersz z tabeli `blocks` (kolumny snake_case) → typ domenowy serii. */
export function rowToSeries(
  row: Pick<BlockRow, 'id' | 'title' | 'category_id' | 'note' | 'start_local' | 'duration_min' | 'timezone' | 'recurrence'>,
): BlockSeries {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    note: row.note,
    startLocal: row.start_local,
    durationMin: row.duration_min,
    timezone: row.timezone,
    recurrence: row.recurrence as Recurrence | null,
  };
}

/**
 * Seria (lub seria bez id / jej częściowy patch) → kolumny `blocks`.
 * Klucze nieobecne w wejściu nie trafiają do wyniku, więc ta sama funkcja
 * obsługuje insert (pełna seria) i update (patch). `user_id` nigdy nie jest ustawiany: robi to default w bazie.
 */
export function seriesToRow(series: Partial<BlockSeries>): Partial<BlockInsert> {
  const row: Partial<BlockInsert> = {};
  if (series.id !== undefined) row.id = series.id;
  if (series.title !== undefined) row.title = series.title;
  if (series.categoryId !== undefined) row.category_id = series.categoryId;
  if (series.note !== undefined) row.note = series.note;
  if (series.startLocal !== undefined) row.start_local = series.startLocal;
  if (series.durationMin !== undefined) row.duration_min = series.durationMin;
  if (series.timezone !== undefined) row.timezone = series.timezone;
  if (series.recurrence !== undefined) row.recurrence = series.recurrence as unknown as Json | null;
  return row;
}

/** Wiersz z tabeli `block_exceptions` → wyjątek. Kolumna null = pole nie jest nadpisane (brak klucza). */
export function rowToException(row: ExceptionRow): BlockException {
  return {
    blockId: row.block_id,
    occurrenceDate: row.occurrence_date,
    cancelled: row.cancelled,
    ...(row.start_local !== null && { startLocal: row.start_local }),
    ...(row.duration_min !== null && { durationMin: row.duration_min }),
    ...(row.title !== null && { title: row.title }),
    ...(row.category_id !== null && { categoryId: row.category_id }),
    ...(row.note !== null && { note: row.note }),
  };
}
