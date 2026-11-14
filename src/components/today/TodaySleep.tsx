import Link from "next/link";
import { addDays, parseISO } from "date-fns";
import { formatMinutes, MONTH_SHORT_NAMES, sleepBars, sleepMinutes, type SleepLog } from "@/lib/sleep/sleep";

type TodaySleepProps = {
  /** Wpisy snu z ostatnich 7 nocy. */
  logs: SleepLog[];
  /** Dzisiejsza data w strefie profilu; ostatnia noc to wpis z tą datą (dzień pobudki). */
  today: string;
  timezone: string;
  goalMin: number;
};

const AXIS_MAX_MIN = 10 * 60;
const CHART_HEIGHT = 44;

/** Karta „Sen”: ostatnia noc i mini wykres 7 nocy z przerywaną linią celu. */
export function TodaySleep({ logs, today, timezone, goalMin }: TodaySleepProps) {
  const lastNight = logs.find((log) => log.date === today);
  // Słupki miesiąca (30 nocy, najnowsza = dziś) przycięte do ostatnich 7.
  const nights = sleepBars(logs, "month", today, timezone, goalMin).slice(-7);
  const hasData = nights.some((night) => night.minutes !== null);

  // „noc 17 → 18 lis”, a na przełomie miesięcy „noc 31 paź → 1 lis”.
  const wake = parseISO(today);
  const sleep = addDays(wake, -1);
  const sleepLabel =
    sleep.getMonth() === wake.getMonth()
      ? String(sleep.getDate())
      : `${sleep.getDate()} ${MONTH_SHORT_NAMES[sleep.getMonth()]}`;
  const nightLabel = `noc ${sleepLabel} → ${wake.getDate()} ${MONTH_SHORT_NAMES[wake.getMonth()]}`;

  return (
    <section aria-label="Ostatnia noc" className="flex flex-col gap-3 rounded-xl border border-[#EAEAE8] bg-white px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <strong className="text-sm font-medium">Sen</strong>
        <span className="text-[13px] text-[#7D7C78]">{nightLabel}</span>
        <Link href="/nawyki" className="ms-auto text-[13px] text-[#7D7C78] hover:text-[#191816]">
          Edytuj
        </Link>
      </div>

      <div className="flex items-end gap-4">
        {lastNight ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-[22px] font-semibold tracking-[-0.01em] text-[#191816]">
              {formatMinutes(sleepMinutes(lastNight.date, lastNight.sleptAt, lastNight.wokeAt, timezone))}
            </span>
            <span className="text-xs text-[#7D7C78]">
              {lastNight.sleptAt} – {lastNight.wokeAt} · samopoczucie {lastNight.feeling}/5
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-[#37352F]">Brak wpisu</span>
            <Link href="/nawyki" className="text-xs text-[#7D7C78] underline-offset-2 hover:underline">
              Zapisz sen z ostatniej nocy
            </Link>
          </div>
        )}

        {hasData && (
          <div
            role="list"
            aria-label="Ostatnie 7 nocy"
            className="relative ms-auto flex items-end gap-1"
            style={{ height: CHART_HEIGHT }}
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-[#CFC8F0]"
              style={{ top: `${(1 - Math.min(goalMin, AXIS_MAX_MIN) / AXIS_MAX_MIN) * 100}%` }}
            />
            {nights.map((night) => (
              <span
                key={night.key}
                role="listitem"
                title={night.title}
                aria-label={night.title}
                className="w-2.5 rounded-[3px]"
                style={{
                  // Noc bez wpisu: niski szary ślad, żeby było widać lukę.
                  height:
                    night.minutes === null
                      ? 2
                      : Math.max(2, Math.round((Math.min(night.minutes, AXIS_MAX_MIN) / AXIS_MAX_MIN) * CHART_HEIGHT)),
                  background:
                    night.minutes === null ? "#F0F0EE" : night.latest ? "#7C6BD6" : night.metGoal ? "#CFC8F0" : "#E7E4F6",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
