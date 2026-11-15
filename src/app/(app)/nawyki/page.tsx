import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { format, parseISO, subWeeks } from "date-fns";
import { HabitList } from "@/components/habits/HabitList";
import { todayIn } from "@/lib/dates";
import { loadHabits } from "@/lib/habits/load";
import { assertValidDate } from "@/lib/habits/rules";
import { toDTO } from "@/lib/habits/types";
import { ensureProfile } from "@/lib/profile";
import { listSleepLogs } from "./sleep-actions";

const HISTORY_WEEKS = 53;

/** `?d=` gdy to prawdziwa data YYYY-MM-DD, inaczej null (brak, tablica albo śmieci = dziś). */
function requestedDay(d: string | string[] | undefined): string | null {
  if (typeof d !== "string") return null;
  try {
    assertValidDate(d);
    return d;
  } catch {
    return null;
  }
}

// Profil, „dziś” i nawyki to dane dynamiczne, więc czytamy je wewnątrz Suspense.
// „Dziś” liczymy w strefie z profilu, w czasie żądania (po connection()).
async function Habits({ searchParams }: { searchParams: PageProps<"/nawyki">["searchParams"] }) {
  const { d } = await searchParams;
  const profile = await ensureProfile();
  await connection();
  const today = todayIn(profile.timezone, new Date());
  const date = requestedDay(d) ?? today;
  if (date > today) redirect("/nawyki");

  // Rok wstecz od oglądanego dnia: nawyki zarchiwizowane w tym czasie też wracają (historia i heatmapa).
  const from = format(subWeeks(parseISO(date), HISTORY_WEEKS), "yyyy-MM-dd");
  const { habits } = await loadHabits(from, today);

  // Sen: 53 tygodnie wstecz od dziś pokrywają każdy zakres wykresu (także 12 miesięcy kalendarzowych).
  // Starszy oglądany dzień dociągamy osobno, żeby formularz pokazał jego wpis.
  const sleepFrom = format(subWeeks(parseISO(today), HISTORY_WEEKS), "yyyy-MM-dd");
  const [sleep, sleepOfDay] = await Promise.all([
    listSleepLogs(sleepFrom, today),
    date < sleepFrom ? listSleepLogs(date, date) : null,
  ]);
  if (!sleep.ok) throw new Error(sleep.error);
  if (sleepOfDay && !sleepOfDay.ok) throw new Error(sleepOfDay.error);
  const sleepLogs = sleepOfDay ? [...sleepOfDay.data, ...sleep.data] : sleep.data;

  // `key`: przejście na inny dzień montuje listę od nowa ze świeżymi danymi z serwera.
  return (
    <HabitList
      key={date}
      initialHabits={habits.map(toDTO)}
      initialSleepLogs={sleepLogs}
      date={date}
      today={today}
      timezone={profile.timezone}
      sleepGoalMin={profile.sleep_goal_min}
    />
  );
}

export default function NawykiPage(props: PageProps<"/nawyki">) {
  return (
    <main className="px-7 pt-5 pb-8 max-md:px-4">
      <Suspense fallback={<p className="text-muted-foreground">Ładowanie…</p>}>
        <Habits searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
