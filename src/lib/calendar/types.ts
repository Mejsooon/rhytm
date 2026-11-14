export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = poniedziałek (ISO)
export type Recurrence =
  | { freq: 'daily'; until?: string } // 'YYYY-MM-DD', włącznie
  | { freq: 'weekdays'; until?: string } // pn–pt
  | { freq: 'weekly'; until?: string } // ten sam dzień tygodnia co start
  | { freq: 'custom'; byWeekday: Weekday[]; until?: string }; // wybrane dni

export type BlockSeries = {
  id: string;
  title: string;
  categoryId: string;
  note: string | null;
  startLocal: string; // 'YYYY-MM-DDTHH:mm'
  durationMin: number;
  timezone: string;
  recurrence: Recurrence | null;
};

export type BlockException = {
  blockId: string;
  occurrenceDate: string;
  cancelled: boolean;
  startLocal?: string;
  durationMin?: number;
  title?: string;
  categoryId?: string;
  note?: string | null;
};

export type Occurrence = {
  blockId: string;
  occurrenceDate: string;
  start: Date;
  end: Date;
  title: string;
  categoryId: string;
  note: string | null;
  recurring: boolean;
  recurrence: Recurrence | null; // powtarzanie serii (do wypełnienia formularza edycji)
};
