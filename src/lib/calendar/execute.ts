import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, parseISO } from 'date-fns';
import type { Database } from '@/lib/db/types';
import { seriesToRow } from './mapping';
import type { Mutation } from './plan-edit';

/**
 * Wykonuje mutacje z `planEdit` / `planDelete` po kolei, jedną pętlą.
 * - `tempId` z `insertSeries` jest podmieniany na prawdziwe id nowej serii w kolejnych mutacjach
 *   (`moveChildren.toTempId`, `shiftChildren.blockId`, `clearExceptionFields.blockId`, `deleteTasksOn.blockId`).
 * - `upsertException` scala nowe pola z istniejącym wyjątkiem tej samej pary
 *   (block_id, occurrence_date), żeby kolejna edycja jednego wystąpienia nie kasowała poprzedniej.
 * Pierwszy błąd Supabase przerywa wykonanie (rzuca Error z polskim prefiksem).
 * Operacje nie są transakcją (PostgREST), ale plan jest uporządkowany tak, by przerwanie w połowie nie gubiło danych.
 */
export async function executeMutations(supabase: SupabaseClient<Database>, mutations: Mutation[]): Promise<void> {
  const realIds = new Map<string, string>();

  for (const m of mutations) {
    let error: { message: string } | null = null;

    switch (m.kind) {
      case 'insertSeries': {
        // Id nadaje baza; zapamiętujemy je pod tempId.
        const res = await supabase.from('blocks').insert(seriesToRow(m.series) as never).select('id').single();
        error = res.error;
        if (!error) realIds.set(m.tempId, (res.data as { id: string }).id);
        break;
      }
      case 'updateSeries': {
        const res = await supabase.from('blocks').update(seriesToRow(m.patch)).eq('id', realIds.get(m.id) ?? m.id);
        error = res.error;
        break;
      }
      case 'upsertException': {
        const ex = m.exception;
        const existing = await supabase
          .from('block_exceptions')
          .select('*')
          .eq('block_id', ex.blockId)
          .eq('occurrence_date', ex.occurrenceDate)
          .maybeSingle();
        if (existing.error) {
          error = existing.error;
          break;
        }
        // Istniejący wiersz jako baza, a pola podane w nowym wyjątku go nadpisują.
        const row: Database['public']['Tables']['block_exceptions']['Insert'] = {
          ...(existing.data ?? {}),
          block_id: ex.blockId,
          occurrence_date: ex.occurrenceDate,
          cancelled: ex.cancelled,
        };
        if (ex.startLocal !== undefined) row.start_local = ex.startLocal;
        if (ex.durationMin !== undefined) row.duration_min = ex.durationMin;
        if (ex.title !== undefined) row.title = ex.title;
        if (ex.categoryId !== undefined) row.category_id = ex.categoryId;
        if (ex.note !== undefined) row.note = ex.note;
        const res = await supabase.from('block_exceptions').upsert(row, { onConflict: 'block_id,occurrence_date' });
        error = res.error;
        break;
      }
      case 'moveChildren': {
        const toId = realIds.get(m.toTempId) ?? m.toTempId;
        const ex = await supabase
          .from('block_exceptions')
          .update({ block_id: toId })
          .eq('block_id', m.fromId)
          .gte('occurrence_date', m.fromDate);
        if (ex.error) {
          error = ex.error;
          break;
        }
        const tasks = await supabase
          .from('block_tasks')
          .update({ block_id: toId })
          .eq('block_id', m.fromId)
          .gte('occurrence_date', m.fromDate);
        error = tasks.error;
        break;
      }
      case 'shiftChildren': {
        // Przesuwa occurrence_date wyjątków i zadań serii o `days` dni. PostgREST nie umie `date + n`,
        // więc idziemy po datach: przy przesunięciu w przód od najpóźniejszej, w tył od najwcześniejszej.
        // Dzięki temu data docelowa jest już wolna (klucz (block_id, occurrence_date) wyjątków się nie zderza),
        // a żadne zadanie nie przesuwa się dwa razy. Przerwanie w połowie niczego nie usuwa.
        const id = realIds.get(m.blockId) ?? m.blockId;
        const exDates = await supabase.from('block_exceptions').select('occurrence_date').eq('block_id', id);
        if (exDates.error) {
          error = exDates.error;
          break;
        }
        const taskDates = await supabase.from('block_tasks').select('occurrence_date').eq('block_id', id);
        if (taskDates.error) {
          error = taskDates.error;
          break;
        }
        const dates = [...new Set([...exDates.data, ...taskDates.data].map((r) => r.occurrence_date))].sort();
        if (m.days > 0) dates.reverse();
        for (const date of dates) {
          const to = format(addDays(parseISO(date), m.days), 'yyyy-MM-dd');
          const ex = await supabase
            .from('block_exceptions')
            .update({ occurrence_date: to })
            .eq('block_id', id)
            .eq('occurrence_date', date);
          if (ex.error) {
            error = ex.error;
            break;
          }
          const tasks = await supabase
            .from('block_tasks')
            .update({ occurrence_date: to })
            .eq('block_id', id)
            .eq('occurrence_date', date);
          if (tasks.error) {
            error = tasks.error;
            break;
          }
        }
        break;
      }
      case 'clearExceptionFields': {
        // Wybrane pola wyjątku wracają do wartości z serii (null = brak nadpisania).
        const columns = { startLocal: 'start_local', durationMin: 'duration_min', title: 'title', categoryId: 'category_id', note: 'note' } as const;
        const patch: Database['public']['Tables']['block_exceptions']['Update'] = {};
        for (const field of m.fields) patch[columns[field]] = null;
        const res = await supabase
          .from('block_exceptions')
          .update(patch)
          .eq('block_id', realIds.get(m.blockId) ?? m.blockId)
          .eq('occurrence_date', m.occurrenceDate);
        error = res.error;
        break;
      }
      case 'deleteChildrenFrom': {
        const ex = await supabase.from('block_exceptions').delete().eq('block_id', m.id).gte('occurrence_date', m.fromDate);
        if (ex.error) {
          error = ex.error;
          break;
        }
        const tasks = await supabase.from('block_tasks').delete().eq('block_id', m.id).gte('occurrence_date', m.fromDate);
        error = tasks.error;
        break;
      }
      case 'deleteTasksOn': {
        const res = await supabase
          .from('block_tasks')
          .delete()
          .eq('block_id', realIds.get(m.blockId) ?? m.blockId)
          .in('occurrence_date', m.dates);
        error = res.error;
        break;
      }
      case 'deleteSeries': {
        // Wyjątki i zadania znikają kaskadowo (FK on delete cascade).
        const res = await supabase.from('blocks').delete().eq('id', m.id);
        error = res.error;
        break;
      }
    }

    if (error) throw new Error(`Nie udało się zapisać bloku: ${error.message}`);
  }
}
