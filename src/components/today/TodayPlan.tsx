import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import type { BlockTask } from "@/app/(app)/kalendarz/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { QUIET_BUTTON_DARK } from "@/components/calendar/quiet-classes";
import { pluralForm } from "@/lib/habits/view";
import { cn } from "@/lib/utils";

/** Dzisiejsze wystąpienie bloku przygotowane na serwerze (godziny w strefie profilu). */
export type PlanBlock = {
  /** `blockId|occurrenceDate`. */
  key: string;
  title: string;
  /** Kolor kropki kategorii. */
  dot: string;
  categoryName: string | null;
  /** „08:00”. */
  start: string;
  end: string;
  /** Blok trwa w chwili żądania (start ≤ teraz < koniec). */
  isNow: boolean;
  tasks: BlockTask[];
};

type TodayPlanProps = {
  blocks: PlanBlock[];
  onToggleTask: (task: BlockTask, done: boolean) => void;
};

/** „zadania” po „z 1”, inaczej „zadań” (dopełniacz). */
function tasksWord(total: number): string {
  return total === 1 ? "zadania" : "zadań";
}

/** Lewa kolumna „Plan dnia”: bloki w kolejności godzin z zadaniami do odhaczenia. */
export function TodayPlan({ blocks, onToggleTask }: TodayPlanProps) {
  const allTasks = blocks.flatMap((block) => block.tasks);
  const doneCount = allTasks.filter((task) => task.done).length;
  const blocksLabel = `${blocks.length} ${pluralForm(blocks.length, "blok", "bloki", "bloków")}`;

  return (
    <section aria-label="Plan dnia" className="overflow-hidden rounded-xl border border-[#EAEAE8] bg-white">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[#EAEAE8] px-4 py-3.5">
        <strong className="text-sm font-medium">Plan dnia</strong>
        {blocks.length > 0 && (
          <span className="text-[13px] text-[#7D7C78]">
            {blocksLabel}
            {allTasks.length > 0 && ` · ${doneCount} z ${allTasks.length} ${tasksWord(allTasks.length)}`}
          </span>
        )}
        <Link href="/kalendarz" className="ms-auto text-[13px] text-[#7D7C78] hover:text-[#191816]">
          Otwórz w kalendarzu →
        </Link>
      </div>

      {blocks.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 px-4 py-8 text-center">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#F4F4F3]">
            <CalendarDaysIcon aria-hidden="true" className="size-[18px] text-[#7D7C78]" />
          </span>
          <strong className="text-[15px] font-semibold">Na dziś nie masz żadnych bloków</strong>
          <p className="max-w-[380px] text-[13px] leading-normal text-[#7D7C78]">
            Zaplanuj dzień w kalendarzu: bloki z zadaniami pojawią się tutaj w kolejności godzin.
          </p>
          <Link href="/kalendarz" className={cn(QUIET_BUTTON_DARK, "mt-1 inline-flex items-center font-medium")}>
            Dodaj blok
          </Link>
        </div>
      ) : (
        <ul className="py-2">
          {blocks.map((block) => {
            const done = block.tasks.filter((task) => task.done).length;
            return (
              <li
                key={block.key}
                className={cn(
                  "flex gap-3 border-t border-[#F0F0EE] px-4 py-3 first:border-t-0",
                  block.isNow && "bg-[#FBFBFA]",
                )}
              >
                <div className="flex w-14 shrink-0 flex-col gap-0.5 pt-px tabular-nums">
                  <span className="text-[13px] font-medium text-[#37352F]">{block.start}</span>
                  <span className="text-xs text-[#9B9A97]">{block.end}</span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: block.dot }}
                      title={block.categoryName ?? undefined}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 text-sm font-medium text-[#191816]">{block.title}</span>
                    {block.isNow && (
                      <span className="rounded-[4px] bg-[#FDECEC] px-1.5 py-px text-[11px] font-medium text-[#E5484D]">
                        Teraz
                      </span>
                    )}
                    <span className="ms-auto text-xs text-[#7D7C78]">
                      {block.tasks.length === 0
                        ? "bez zadań"
                        : `${done}/${block.tasks.length} ${tasksWord(block.tasks.length)}`}
                    </span>
                  </div>
                  {block.tasks.length > 0 && (
                    <ul className="flex flex-col">
                      {block.tasks.map((task) => (
                        <li key={task.id}>
                          <label className="flex min-h-7 cursor-pointer items-center gap-2.5 max-md:min-h-10">
                            <Checkbox
                              className="size-[22px] md:size-4"
                              checked={task.done}
                              onCheckedChange={(checked) => onToggleTask(task, checked === true)}
                            />
                            <span
                              className={cn(
                                "min-w-0 text-[13px] text-[#37352F]",
                                task.done && "text-[#9B9A97] line-through",
                              )}
                            >
                              {task.title}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
