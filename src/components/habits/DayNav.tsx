import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { dayHeading } from "@/lib/habits/view";

const ARROW =
  "flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#E6E6E4] bg-white text-[#37352F] outline-none hover:bg-[#F7F7F6] focus-visible:ring-2 focus-visible:ring-ring";

function dayHref(date: string, today: string): string {
  return date === today ? "/nawyki" : `/nawyki?d=${date}`;
}

/** „←” poprzedni dzień, napis dnia, „→” następny (tylko gdy oglądany dzień nie jest dzisiejszy). Linki ?d=. */
export function DayNav({ date, today }: { date: string; today: string }) {
  const previous = format(addDays(parseISO(date), -1), "yyyy-MM-dd");
  const next = format(addDays(parseISO(date), 1), "yyyy-MM-dd");

  return (
    <nav aria-label="Dzień" className="flex items-center gap-1.5">
      <Link href={dayHref(previous, today)} aria-label="Poprzedni dzień" className={ARROW}>
        <ChevronLeftIcon aria-hidden="true" className="size-[15px]" />
      </Link>
      <span className="px-1.5 text-[13px] text-[#37352F]" aria-live="polite">
        {dayHeading(date, today)}
      </span>
      {date !== today && (
        <Link href={dayHref(next, today)} aria-label="Następny dzień" className={ARROW}>
          <ChevronRightIcon aria-hidden="true" className="size-[15px]" />
        </Link>
      )}
    </nav>
  );
}
