export type ScheduleType = 'daily' | 'days' | 'weekly' | 'none';

export type HabitSchedule = {
  /** First day (YYYY-MM-DD) this version applies. */
  validFrom: string;
  type: ScheduleType;
  /** ISO weekdays, 1 = Monday ... 7 = Sunday. Used by 'days'. */
  weekdays: number[];
  /** 1-7, used by 'weekly'. */
  timesPerWeek: number | null;
};

export type HabitHistory = {
  id: string;
  name: string;
  /** YYYY-MM-DD */
  createdOn: string;
  /** Day the habit was archived (YYYY-MM-DD); it no longer counts from that day. */
  archivedOn: string | null;
  schedules: HabitSchedule[];
  /** Days (YYYY-MM-DD) the habit was checked off. */
  checks: ReadonlySet<string>;
};

/** HabitHistory as it travels over the wire (Server Actions cannot return a Set). */
export type HabitHistoryDTO = Omit<HabitHistory, 'checks'> & { checks: string[] };

export function toDTO(habit: HabitHistory): HabitHistoryDTO {
  return { ...habit, checks: [...habit.checks] };
}

export function fromDTO(dto: HabitHistoryDTO): HabitHistory {
  return { ...dto, checks: new Set(dto.checks) };
}
