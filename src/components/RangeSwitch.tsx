"use client";

import type { HeatRange } from "@/lib/habits/heatmap";
import { cn } from "@/lib/utils";

const RANGES: { value: HeatRange; label: string }[] = [
  { value: "month", label: "Miesiąc" },
  { value: "quarter", label: "3 miesiące" },
  { value: "half", label: "Pół roku" },
  { value: "year", label: "Rok" },
];

type RangeSwitchProps = {
  value: HeatRange;
  onChange: (range: HeatRange) => void;
  /** Nazwa grupy dla czytników ekranu, np. „Zakres heatmapy”. */
  "aria-label"?: string;
};

/** Przełącznik zakresu w cichym stylu: Miesiąc / 3 miesiące / Pół roku / Rok (heatmapa nawyków i wykres snu). */
export function RangeSwitch({ value, onChange, "aria-label": ariaLabel = "Zakres" }: RangeSwitchProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex h-8 w-max shrink-0 gap-0.5 rounded-lg bg-[#F4F4F3] p-0.5">
      {RANGES.map((range) => {
        const active = range.value === value;
        return (
          <button
            key={range.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(range.value)}
            className={cn(
              "h-[26px] rounded-md border px-2.5 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-[#E6E6E4] bg-white text-[#191816] shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
                : "border-transparent bg-transparent text-[#7D7C78] hover:text-[#191816]",
            )}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
