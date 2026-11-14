import { describe, expect, it } from 'vitest';
import { executeMutations } from './execute';
import type { Mutation } from './plan-edit';

type Op = {
  table: string;
  op: string;
  values?: unknown;
  opts?: unknown;
  filters: [string, string, unknown][];
};

// Fake klienta Supabase: zapisuje operacje, a odpowiedzi daje handler (domyślnie sukces bez danych).
function makeClient(handler: (op: Op) => { data?: unknown; error?: { message: string } | null } = () => ({ data: null })) {
  const ops: Op[] = [];
  const client = {
    from(table: string) {
      const op: Op = { table, op: '', filters: [] };
      const builder: Record<string, unknown> = {
        select: () => { if (!op.op) op.op = 'select'; return builder; },
        insert: (values: unknown) => { op.op = 'insert'; op.values = values; return builder; },
        update: (values: unknown) => { op.op = 'update'; op.values = values; return builder; },
        upsert: (values: unknown, opts: unknown) => { op.op = 'upsert'; op.values = values; op.opts = opts; return builder; },
        delete: () => { op.op = 'delete'; return builder; },
        eq: (c: string, v: unknown) => { op.filters.push([c, 'eq', v]); return builder; },
        gte: (c: string, v: unknown) => { op.filters.push([c, 'gte', v]); return builder; },
        in: (c: string, v: unknown) => { op.filters.push([c, 'in', v]); return builder; },
        single: () => Promise.resolve(run()),
        maybeSingle: () => Promise.resolve(run()),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
      };
      function run() {
        ops.push(op);
        const r = handler(op);
        return { data: r.data ?? null, error: r.error ?? null };
      }
      return builder;
    },
  };
  return { client: client as never, ops };
}

const series = { title: 'Nauka', color: 'blue', note: null, startLocal: '2026-11-16T09:00', durationMin: 60, timezone: 'Europe/Warsaw', recurrence: null };

describe('executeMutations', () => {
  it('podmienia tempId na prawdziwe id po insertSeries w kolejnych mutacjach', async () => {
    const { client, ops } = makeClient((op) => (op.op === 'insert' ? { data: { id: 'real-1' } } : { data: null }));
    const mutations: Mutation[] = [
      { kind: 'insertSeries', tempId: 'new-series', series },
      { kind: 'moveChildren', fromId: 'old', toTempId: 'new-series', fromDate: '2026-11-20' },
      { kind: 'deleteTasksOn', blockId: 'new-series', dates: ['2026-11-21'] },
    ];
    await executeMutations(client, mutations);

    expect(ops[0]).toMatchObject({ table: 'blocks', op: 'insert' });
    expect((ops[0].values as Record<string, unknown>).id).toBeUndefined();
    const moves = ops.filter((o) => o.op === 'update');
    expect(moves.map((o) => o.table)).toEqual(['block_exceptions', 'block_tasks']);
    for (const m of moves) {
      expect(m.values).toEqual({ block_id: 'real-1' });
      expect(m.filters).toEqual([['block_id', 'eq', 'old'], ['occurrence_date', 'gte', '2026-11-20']]);
    }
    const del = ops.find((o) => o.op === 'delete')!;
    expect(del.table).toBe('block_tasks');
    expect(del.filters).toEqual([['block_id', 'eq', 'real-1'], ['occurrence_date', 'in', ['2026-11-21']]]);
  });

  it('scala upsertException z istniejącym wyjątkiem tej samej daty', async () => {
    const existing = {
      block_id: 'b1', occurrence_date: '2026-11-17', cancelled: false,
      start_local: null, duration_min: 45, title: 'Stary tytuł', color: null, note: 'stara notatka',
    };
    const { client, ops } = makeClient((op) => (op.op === 'select' ? { data: existing } : { data: null }));
    await executeMutations(client, [
      { kind: 'upsertException', exception: { blockId: 'b1', occurrenceDate: '2026-11-17', cancelled: false, title: 'Nowy tytuł', color: 'red' } },
    ]);
    const up = ops.find((o) => o.op === 'upsert')!;
    expect(up.table).toBe('block_exceptions');
    expect(up.opts).toEqual({ onConflict: 'block_id,occurrence_date' });
    expect(up.values).toEqual({
      block_id: 'b1', occurrence_date: '2026-11-17', cancelled: false,
      start_local: null, duration_min: 45, title: 'Nowy tytuł', color: 'red', note: 'stara notatka',
    });
  });

  it('upsertException bez istniejącego wiersza zapisuje tylko podane pola', async () => {
    const { client, ops } = makeClient();
    await executeMutations(client, [{ kind: 'upsertException', exception: { blockId: 'b1', occurrenceDate: '2026-11-17', cancelled: true } }]);
    expect(ops.find((o) => o.op === 'upsert')!.values).toEqual({ block_id: 'b1', occurrence_date: '2026-11-17', cancelled: true });
  });

  it('updateSeries mapuje patch na kolumny; deleteChildrenFrom i deleteSeries kasują właściwe wiersze', async () => {
    const { client, ops } = makeClient();
    await executeMutations(client, [
      { kind: 'updateSeries', id: 'b1', patch: { durationMin: 30, recurrence: { freq: 'daily', until: '2026-11-19' } } },
      { kind: 'deleteChildrenFrom', id: 'b1', fromDate: '2026-11-20' },
      { kind: 'deleteSeries', id: 'b2' },
    ]);
    expect(ops[0]).toMatchObject({ table: 'blocks', op: 'update', values: { duration_min: 30, recurrence: { freq: 'daily', until: '2026-11-19' } }, filters: [['id', 'eq', 'b1']] });
    expect(ops.slice(1, 3).map((o) => [o.table, o.op, o.filters])).toEqual([
      ['block_exceptions', 'delete', [['block_id', 'eq', 'b1'], ['occurrence_date', 'gte', '2026-11-20']]],
      ['block_tasks', 'delete', [['block_id', 'eq', 'b1'], ['occurrence_date', 'gte', '2026-11-20']]],
    ]);
    expect(ops[3]).toMatchObject({ table: 'blocks', op: 'delete', filters: [['id', 'eq', 'b2']] });
  });

  it('shiftChildren w przód: daty od najpóźniejszej (bez kolizji klucza wyjątków), tempId podmieniony', async () => {
    const { client, ops } = makeClient((op) => {
      if (op.op === 'insert') return { data: { id: 'real-1' } };
      if (op.op === 'select' && op.table === 'block_exceptions') return { data: [{ occurrence_date: '2026-11-16' }] };
      if (op.op === 'select' && op.table === 'block_tasks') return { data: [{ occurrence_date: '2026-11-17' }, { occurrence_date: '2026-11-16' }] };
      return { data: null };
    });
    await executeMutations(client, [
      { kind: 'insertSeries', tempId: 'new-series', series },
      { kind: 'shiftChildren', blockId: 'new-series', days: 1 },
    ]);
    const selects = ops.filter((o) => o.op === 'select');
    expect(selects.map((o) => [o.table, o.filters])).toEqual([
      ['block_exceptions', [['block_id', 'eq', 'real-1']]],
      ['block_tasks', [['block_id', 'eq', 'real-1']]],
    ]);
    // 17.11 -> 18.11 musi pójść przed 16.11 -> 17.11.
    expect(ops.filter((o) => o.op === 'update').map((o) => [o.table, o.values, o.filters])).toEqual([
      ['block_exceptions', { occurrence_date: '2026-11-18' }, [['block_id', 'eq', 'real-1'], ['occurrence_date', 'eq', '2026-11-17']]],
      ['block_tasks', { occurrence_date: '2026-11-18' }, [['block_id', 'eq', 'real-1'], ['occurrence_date', 'eq', '2026-11-17']]],
      ['block_exceptions', { occurrence_date: '2026-11-17' }, [['block_id', 'eq', 'real-1'], ['occurrence_date', 'eq', '2026-11-16']]],
      ['block_tasks', { occurrence_date: '2026-11-17' }, [['block_id', 'eq', 'real-1'], ['occurrence_date', 'eq', '2026-11-16']]],
    ]);
  });

  it('shiftChildren w tył: daty od najwcześniejszej', async () => {
    const { client, ops } = makeClient((op) =>
      op.op === 'select' ? { data: [{ occurrence_date: '2026-11-18' }, { occurrence_date: '2026-11-16' }] } : { data: null },
    );
    await executeMutations(client, [{ kind: 'shiftChildren', blockId: 'b1', days: -2 }]);
    expect(ops.filter((o) => o.op === 'update' && o.table === 'block_tasks').map((o) => [o.values, o.filters[1]])).toEqual([
      [{ occurrence_date: '2026-11-14' }, ['occurrence_date', 'eq', '2026-11-16']],
      [{ occurrence_date: '2026-11-16' }, ['occurrence_date', 'eq', '2026-11-18']],
    ]);
  });

  it('clearExceptionFields ustawia wybrane kolumny wyjątku na null', async () => {
    const { client, ops } = makeClient();
    await executeMutations(client, [
      { kind: 'clearExceptionFields', blockId: 'b1', occurrenceDate: '2026-11-17', fields: ['startLocal', 'durationMin', 'note'] },
    ]);
    expect(ops).toEqual([
      {
        table: 'block_exceptions',
        op: 'update',
        values: { start_local: null, duration_min: null, note: null },
        filters: [['block_id', 'eq', 'b1'], ['occurrence_date', 'eq', '2026-11-17']],
      },
    ]);
  });

  it('rzuca błąd z polskim prefiksem i przerywa kolejne mutacje', async () => {
    const { client, ops } = makeClient((op) => (op.table === 'blocks' ? { error: { message: 'boom' } } : { data: null }));
    await expect(
      executeMutations(client, [
        { kind: 'updateSeries', id: 'b1', patch: { title: 'x' } },
        { kind: 'deleteChildrenFrom', id: 'b1', fromDate: '2026-11-20' },
      ]),
    ).rejects.toThrow('Nie udało się zapisać bloku: boom');
    expect(ops).toHaveLength(1);
  });
});
