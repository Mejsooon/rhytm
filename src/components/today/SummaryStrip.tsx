import Link from "next/link";
import { formatMinutes, sleepMinutes, type SleepLog } from "@/lib/sleep/sleep";

type SummaryStripProps = {
  /** Zadania ze wszystkich dzisiejszych bloków. */
  tasks: { done: number; total: number };
  /** Wynik dnia nawyków (dayScore). */
  habits: { done: number; total: number; pct: number | null };
  /** Wpis snu z dzisiejszą datą (ostatnia noc) albo null. */
  lastNight: SleepLog | null;
  timezone: string;
  sleepGoalMin: number;
};

const TILE = "flex min-w-0 flex-col gap-1.5 px-4 py-3.5";
const LABEL = "text-xs text-[#7D7C78]";
const VALUE = "text-xl font-semibold tracking-[-0.01em] text-[#191816]";
const UNIT = "text-[13px] font-normal text-[#7D7C78]";

/** Cienki pasek postępu pod wartością kafelka. */
function Bar({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <span
      className="flex h-1 rounded-sm bg-[#F0F0EE]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span className="h-full rounded-sm transition-[width]" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

/** Trzy kafelki: zadania, nawyki i ostatnia noc. Bez danych kafelek pokazuje „—” i pusty pasek. */
export function SummaryStrip({ tasks, habits, lastNight, timezone, sleepGoalMin }: SummaryStripProps) {
  const tasksPct = tasks.total === 0 ? 0 : Math.round((tasks.done / tasks.total) * 100);
  const sleptMin = lastNight ? sleepMinutes(lastNight.date, lastNight.sleptAt, lastNight.wokeAt, timezone) : null;

  return (
    <section
      aria-label="Podsumowanie dnia"
      className="grid overflow-hidden rounded-xl border border-[#EAEAE8] bg-white max-sm:divide-y sm:grid-cols-3 sm:divide-x divide-[#EAEAE8]"
    >
      <div className={TILE}>
        <span className={LABEL}>Zadania</span>
        <span className={VALUE}>
          {tasks.total === 0 ? <span className={UNIT}>Brak zadań na dziś</span> : `${tasks.done} z ${tasks.total}`}
        </span>
        <Bar pct={tasksPct} color="#37352F" label="Zrobione zadania" />
      </div>

      <div className={TILE}>
        <span className={LABEL}>Nawyki</span>
        <span className={VALUE}>
          {habits.pct === null ? (
            <span className={UNIT}>Nic zaplanowanego</span>
          ) : (
            <>
              {habits.done} z {habits.total}
              <span className={UNIT}> · {habits.pct}%</span>
            </>
          )}
        </span>
        <Bar pct={habits.pct ?? 0} color="#3E9B63" label="Wynik nawyków" />
      </div>

      <div className={TILE}>
        <span className={LABEL}>Sen</span>
        <span className={VALUE}>
          {lastNight && sleptMin !== null ? (
            <>
              {formatMinutes(sleptMin)}
              <span className={UNIT}> · {lastNight.feeling}/5</span>
            </>
          ) : (
            <span className={UNIT}>
              Brak wpisu ·{" "}
              <Link href="/nawyki" className="font-medium text-[#37352F] underline-offset-2 hover:underline">
                Zapisz sen
              </Link>
            </span>
          )}
        </span>
        <Bar
          pct={sleptMin === null ? 0 : Math.min(100, Math.round((sleptMin / sleepGoalMin) * 100))}
          color="#7C6BD6"
          label="Sen względem celu"
        />
      </div>
    </section>
  );
}
