import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { dayScore } from "@/lib/habits/schedule";
import type { HabitHistory } from "@/lib/habits/types";
import { dayRows } from "@/lib/habits/view";
import { cn } from "@/lib/utils";

type TodayHabitsProps = {
  habits: HabitHistory[];
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD). */
  today: string;
  onToggle: (habit: HabitHistory, done: boolean) => void;
};

/** Karta „Nawyki”: dzisiejsza lista do odhaczenia (te same wiersze i opisy co na /nawyki). */
export function TodayHabits({ habits, today, onToggle }: TodayHabitsProps) {
  const rows = dayRows(habits, today, today);
  const score = dayScore(habits, today);

  return (
    <section aria-label="Nawyki na dziś" className="overflow-hidden rounded-xl border border-[#EAEAE8] bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#EAEAE8] px-4 py-3.5">
        <strong className="text-sm font-medium">Nawyki</strong>
        {rows.length > 0 && (
          <span className="text-[13px] text-[#7D7C78]">
            {score.done} z {score.total} zaplanowanych
          </span>
        )}
        <Link href="/nawyki" className="ms-auto text-[13px] text-[#7D7C78] hover:text-[#191816]">
          Wszystkie →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-[#9B9A97]">
          Nie masz jeszcze nawyków.{" "}
          <Link href="/nawyki" className="font-medium text-[#37352F] underline-offset-2 hover:underline">
            Dodaj pierwszy
          </Link>
        </p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={row.habit.id} className={cn("border-t border-[#F0F0EE] first:border-t-0", row.offDay && "opacity-60")}>
              <label className="flex min-h-10 cursor-pointer items-center gap-2.5 px-4 max-md:min-h-12">
                <Checkbox
                  className="size-[22px] md:size-4"
                  checked={row.checked}
                  onCheckedChange={(checked) => onToggle(row.habit, checked === true)}
                />
                <span
                  className={cn("min-w-0 truncate text-[13px] text-[#191816]", row.checked && "text-[#9B9A97] line-through")}
                >
                  {row.habit.name}
                </span>
                {row.meta && <span className="ms-auto shrink-0 text-xs text-[#9B9A97]">{row.meta}</span>}
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
