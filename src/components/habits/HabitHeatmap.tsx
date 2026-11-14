"use client";

import { useState } from "react";
import { RangeSwitch } from "@/components/RangeSwitch";
import { heatLevel, heatmapDays, heatStats, monthCalendarDays, type HeatRange } from "@/lib/habits/heatmap";
import { dayScore } from "@/lib/habits/schedule";
import type { HabitHistory } from "@/lib/habits/types";
import { cn } from "@/lib/utils";

const LEVEL_COLORS = {
  empty: "#F4F4F3",
  zero: "#E6E6E4",
  1: "#D9EEDF",
  2: "#AEDABB",
  3: "#73BD8C",
  4: "#3E9B63",
} as const;
const LEGEND_COLORS = [LEVEL_COLORS.zero, LEVEL_COLORS[1], LEVEL_COLORS[2], LEVEL_COLORS[3], LEVEL_COLORS[4]];

const TITLES: Record<HeatRange, string> = {
  month: "Ostatni miesiąc",
  quarter: "Ostatnie 3 miesiące",
  half: "Ostatnie pół roku",
  year: "Ostatni rok",
};
// Kratka w px i odstęp; przy „Rok” kratki same się zmniejszają, gdy 53 tygodnie nie mieszczą się w kolumnie 880 px.
const CELL_SIZE = { quarter: 22, half: 18, year: 14 } as const;
const CELL_GAP = { quarter: 3, half: 3, year: 2 } as const;
const WEEKDAY_LABELS = ["Pn", "", "Śr", "", "Pt", "", ""];
const CALENDAR_WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

type HabitHeatmapProps = {
  habits: HabitHistory[];
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD); wszystkie zakresy kończą się na dziś. */
  today: string;
};

/**
 * Heatmapa „% nawyków dziennie”. `month` = kalendarz bieżącego miesiąca z numerami dni, pozostałe zakresy
 * = siatka tygodni (Pn–Nd) z etykietami miesięcy. Dane: historia nawyków ze strony (~53 tygodnie),
 * więc każdy zakres liczy się po stronie klienta, bez dodatkowych zapytań.
 */
export function HabitHeatmap({ habits, today }: HabitHeatmapProps) {
  const [range, setRange] = useState<HeatRange>("half");

  // Podpis i kolor dnia; dni po dzisiejszym nie mają koloru ani podpisu.
  function describeDay(date: string) {
    if (date > today) return { color: "transparent", level: null, title: undefined };
    const { pct } = dayScore(habits, date);
    const level = heatLevel(pct);
    const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    return { color: LEVEL_COLORS[level], level, title: `${label} · ${pct === null ? "brak nawyków" : `${pct}%`}` };
  }

  const grid = range === "month" ? null : { ...heatmapDays(range, today), size: CELL_SIZE[range], gap: CELL_GAP[range] };
  const from = grid ? grid.weeks[0][0] : `${today.slice(0, 7)}-01`;
  const stats = heatStats(habits, from, today);

  return (
    <section
      aria-label="Heatmapa nawyków"
      className="flex flex-col gap-3.5 overflow-x-auto rounded-xl border border-[#EAEAE8] bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <strong className="text-sm font-medium">{TITLES[range]}</strong>
        <span className="text-xs text-[#9B9A97]">% nawyków dziennie</span>
        <div className="ms-auto">
          <RangeSwitch value={range} onChange={setRange} aria-label="Zakres heatmapy" />
        </div>
      </div>

      {grid === null ? (
        // Kalendarz bieżącego miesiąca 7×6: dni spoza miesiąca wyszarzone, przyszłe z przerywaną ramką.
        <div className="grid w-max grid-cols-[repeat(7,44px)] gap-1 max-sm:w-full max-sm:grid-cols-7">
          {CALENDAR_WEEKDAYS.map((label) => (
            <span key={label} aria-hidden="true" className="pb-0.5 text-center text-[11px] text-[#9B9A97]">
              {label}
            </span>
          ))}
          {monthCalendarDays(today).map(({ date, inMonth }) => {
            const day = describeDay(date);
            const future = date > today;
            return (
              <span
                key={date}
                title={inMonth ? day.title : undefined}
                className={cn(
                  "flex h-9 items-center justify-center rounded-lg text-xs",
                  !inMonth && "text-[#C9C8C5]",
                  inMonth && future && "border border-dashed border-[#E6E6E4] text-[#9B9A97]",
                  inMonth && !future && "font-medium",
                  inMonth && !future && (day.level === 3 || day.level === 4 ? "text-white" : "text-[#37352F]"),
                  date === today && "shadow-[0_0_0_2px_#FFFFFF,0_0_0_3.5px_#191816]",
                )}
                style={{ background: inMonth ? day.color : "transparent" }}
              >
                {Number(date.slice(8))}
              </span>
            );
          })}
        </div>
      ) : (
        // Jedna siatka: wiersz 1 = miesiące, kolumna 1 = Pn/Śr/Pt, reszta = tygodnie × 7 dni.
        <div
          className="grid w-max max-w-full text-[11px] leading-none text-[#9B9A97]"
          style={{
            gridTemplateColumns: `auto repeat(${grid.weeks.length}, minmax(6px, ${grid.size}px))`,
            gap: grid.gap,
          }}
        >
          {grid.monthLabels.map((month, index) => {
            // Etykieta zajmuje kolumny do następnej; zbyt wąska (pierwsza, ucięta) jest pomijana.
            const span = (grid.monthLabels[index + 1]?.col ?? grid.weeks.length) - month.col;
            if (span < 2) return null;
            return (
              <span
                key={month.col}
                aria-hidden="true"
                className="overflow-hidden pb-1 whitespace-nowrap"
                style={{ gridRow: 1, gridColumn: `${month.col + 2} / span ${span}` }}
              >
                {month.label}
              </span>
            );
          })}
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="flex items-center pe-1.5"
              style={{ gridRow: index + 2, gridColumn: 1 }}
            >
              {label}
            </span>
          ))}
          {grid.weeks.map((week, col) =>
            week.map((date, row) => {
              const day = describeDay(date);
              return (
                <span
                  key={date}
                  title={day.title}
                  className={cn(
                    "aspect-square",
                    range === "quarter" ? "rounded-[5px]" : "rounded-[3px]",
                    date === today && "shadow-[inset_0_0_0_1.5px_#191816]",
                  )}
                  style={{ gridRow: row + 2, gridColumn: col + 2, background: day.color }}
                />
              );
            }),
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-xs text-[#9B9A97]">
          mniej
          {LEGEND_COLORS.map((color) => (
            <span key={color} aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: color }} />
          ))}
          więcej
        </div>
        <span className="ms-auto text-[13px] text-[#7D7C78]">
          Średnio <span className="font-medium text-[#191816]">{stats.avgPct === null ? "—" : `${stats.avgPct}%`}</span>
          {" · "}najdłuższa seria{" "}
          <span className="font-medium text-[#191816]">
            {stats.bestRun} {stats.bestRun === 1 ? "dzień" : "dni"}
          </span>
        </span>
      </div>
    </section>
  );
}
