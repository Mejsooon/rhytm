"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  miniCalendarWeeks,
  miniDayLabel,
  miniMonthTitle,
  shiftMonth,
  type MiniHighlight,
} from "@/lib/calendar/mini-calendar";

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const GRID = "grid grid-cols-[22px_repeat(7,1fr)] items-center";

type Props = {
  /** 'YYYY-MM' */
  month: string;
  /** 'YYYY-MM-DD' w strefie użytkownika */
  today: string;
  highlight: MiniHighlight;
  onPickDate: (date: string) => void;
  onMonthChange: (month: string) => void;
};

const arrowClass =
  "flex size-6 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[#7D7C78] hover:bg-[#EFEFED]";

export function MiniCalendar({ month, today, highlight, onPickDate, onMonthChange }: Props) {
  const weeks = miniCalendarWeeks(month);

  return (
    <div aria-label="Mini kalendarz" className="flex flex-col gap-1 px-0.5">
      <div className="flex items-center justify-between pb-1 pl-2">
        <span className="text-[13px] font-semibold text-[#191816]">{miniMonthTitle(month)}</span>
        <span className="flex gap-0.5">
          <button type="button" aria-label="Poprzedni miesiąc" className={arrowClass} onClick={() => onMonthChange(shiftMonth(month, -1))}>
            <ChevronLeftIcon className="size-3.5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Następny miesiąc" className={arrowClass} onClick={() => onMonthChange(shiftMonth(month, 1))}>
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>
      <div className={`${GRID} h-[22px] text-center text-[11px] text-[#9B9A97]`}>
        <span />
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      {weeks.map((w) => {
        const band =
          highlight?.kind === "week" && w.days[0].date === highlight.from && w.days[6].date === highlight.to;
        return (
          <div key={w.days[0].date} className={`${GRID} h-7 rounded-lg ${band ? "bg-[#EFEFED]" : "bg-transparent"}`}>
            <span className="text-center text-[10px] text-[#B8B7B4]">{w.week}</span>
            {w.days.map((d) => {
              const isToday = d.date === today;
              const picked = !isToday && highlight?.kind === "day" && highlight.date === d.date;
              const tone = isToday
                ? "bg-[#191816] font-semibold text-white"
                : picked
                  ? "bg-[#E6E6E4] font-normal text-[#191816]"
                  : `bg-transparent font-normal ${d.inMonth ? "text-[#37352F]" : "text-[#B8B7B4]"}`;
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-label={miniDayLabel(d.date)}
                  aria-current={isToday ? "date" : undefined}
                  onClick={() => onPickDate(d.date)}
                  className={`mx-auto flex size-6 cursor-pointer items-center justify-center rounded-full border-0 p-0 text-xs ${tone}`}
                >
                  {d.day}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
