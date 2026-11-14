"use client";

import { useState } from "react";
import { RangeSwitch } from "@/components/RangeSwitch";
import type { HeatRange } from "@/lib/habits/heatmap";
import { formatMinutes, sleepBars, sleepStats, type SleepLog } from "@/lib/sleep/sleep";
import { cn } from "@/lib/utils";

const TITLES: Record<HeatRange, string> = {
  month: "Sen · ostatni miesiąc",
  quarter: "Sen · ostatnie 3 miesiące",
  half: "Sen · ostatnie pół roku",
  year: "Sen · ostatni rok",
};
const CAPTIONS: Record<HeatRange, string> = {
  month: "godziny snu · każda noc",
  quarter: "średnia tygodniowa",
  half: "średnia tygodniowa",
  year: "średnia miesięczna",
};
const AXIS_MAX_MIN = 10 * 60;

type SleepChartProps = {
  logs: SleepLog[];
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD); najnowszy słupek to dziś / bieżący tydzień / miesiąc. */
  today: string;
  timezone: string;
  /** Cel snu z profilu (sleep_goal_min). */
  goalMin: number;
};

/**
 * Wykres słupkowy snu z przerywaną linią celu. `month` = 30 nocy, `quarter`/`half` = średnie tygodni,
 * `year` = średnie 12 miesięcy. Oś 0–10 h; dłuższe noce są ucinane do góry wykresu.
 */
export function SleepChart({ logs, today, timezone, goalMin }: SleepChartProps) {
  const [range, setRange] = useState<HeatRange>("half");

  const bars = sleepBars(logs, range, today, timezone, goalMin);
  // Pierwszy słupek wyznacza początek okresu: data nocy, poniedziałek tygodnia albo miesiąc „yyyy-MM”.
  const from = bars[0].key.length === 7 ? `${bars[0].key}-01` : bars[0].key;
  const stats = sleepStats(logs, from, today, timezone);
  const hasData = bars.some((bar) => bar.minutes !== null);
  const labeledCount = bars.filter((bar) => bar.label !== "").length;
  const gap = bars.length > 20 ? 3 : 6;
  const goalTop = `${(1 - Math.min(goalMin, AXIS_MAX_MIN) / AXIS_MAX_MIN) * 100}%`;

  return (
    <section aria-label="Wykres snu" className="flex flex-col gap-3.5 rounded-xl border border-[#EAEAE8] bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <strong className="text-sm font-medium">{TITLES[range]}</strong>
        <span className="text-xs text-[#9B9A97]">{CAPTIONS[range]}</span>
        <div className="ms-auto">
          <RangeSwitch value={range} onChange={setRange} aria-label="Zakres wykresu snu" />
        </div>
      </div>

      {!hasData ? (
        <p className="py-10 text-center text-[13px] text-[#9B9A97]">Brak wpisów w tym okresie</p>
      ) : (
        <>
          <div className="flex gap-2">
            <div
              aria-hidden="true"
              className="flex h-[180px] w-7 shrink-0 flex-col justify-between text-end text-[11px] leading-none text-[#9B9A97]"
            >
              <span>10 h</span>
              <span>5 h</span>
              <span>0</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="relative h-[180px] border-b border-[#EAEAE8]">
                <div className="absolute inset-x-0 border-t border-dashed border-[#CFC8F0]" style={{ top: goalTop }} />
                <span
                  className="absolute end-0 z-10 -translate-y-full bg-white ps-1 pb-0.5 text-[11px] leading-none text-[#9B9A97]"
                  style={{ top: goalTop }}
                >
                  cel {formatMinutes(goalMin)}
                </span>
                <div role="list" aria-label="Godziny snu" className="absolute inset-0 flex items-end" style={{ gap }}>
                  {bars.map((bar) => (
                    // Cała kolumna niesie podpis, więc najeżdżanie działa też nad pustym słupkiem.
                    <span key={bar.key} role="listitem" title={bar.title} aria-label={bar.title} className="flex h-full min-w-0 flex-1 items-end">
                      <span
                        className="w-full rounded-t-[4px] rounded-b-[2px]"
                        style={{
                          height: `${(Math.min(bar.minutes ?? 0, AXIS_MAX_MIN) / AXIS_MAX_MIN) * 100}%`,
                          background: bar.latest ? "#7C6BD6" : bar.metGoal ? "#CFC8F0" : "#E7E4F6",
                        }}
                      />
                    </span>
                  ))}
                </div>
              </div>
              <div aria-hidden="true" className="flex h-3.5" style={{ gap }}>
                {bars.map((bar, index) => {
                  // Na wąskim ekranie przy więcej niż 7 podpisach zostaje co drugi (licząc od najnowszego), żeby nie nachodziły.
                  const labelsFromEnd = bars.slice(index + 1).filter((next) => next.label !== "").length;
                  const thinOut = labeledCount > 7 && labelsFromEnd % 2 === 1;
                  return (
                    <span
                      key={bar.key}
                      className={cn(
                        "min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-[#9B9A97]",
                        thinOut && "max-sm:invisible",
                      )}
                    >
                      {bar.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {stats.avgMinutes !== null && (
            <p className="ms-auto text-[13px] text-[#7D7C78]">
              Średnio <span className="font-medium text-[#191816]">{formatMinutes(stats.avgMinutes)}</span>
              {" · "}zaśnięcie <span className="font-medium text-[#191816]">{stats.avgBedtime}</span>
              {" · "}samopoczucie{" "}
              <span className="font-medium text-[#191816]">
                {stats.avgFeeling?.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/5
              </span>
            </p>
          )}
        </>
      )}
    </section>
  );
}
