import { Suspense } from "react";
import { connection } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TodayView } from "@/components/today/TodayView";
import type { PlanBlock } from "@/components/today/TodayPlan";
import { listOccurrences } from "@/lib/calendar/list-occurrences";
import { categoryColor } from "@/lib/calendar/colors";
import { todayIn } from "@/lib/dates";
import { loadHabits } from "@/lib/habits/load";
import { toDTO } from "@/lib/habits/types";
import { ensureProfile } from "@/lib/profile";
import { listTasks } from "../kalendarz/actions";
import { listCategories } from "../kalendarz/category-actions";
import { listSleepLogs } from "../nawyki/sleep-actions";

// Profil, użytkownik i dzisiejsze dane są dynamiczne, więc czytamy je wewnątrz Suspense.
// „Dziś” i „teraz” liczymy w czasie żądania (po connection()), w strefie z profilu.
async function Today() {
  const profile = await ensureProfile();
  const user = await currentUser();
  await connection();
  const now = new Date();
  const today = todayIn(profile.timezone, now);

  const [occurrences, categories, { habits }, sleep] = await Promise.all([
    listOccurrences(today, today),
    listCategories(),
    loadHabits(today, today),
    // Ostatnie 7 nocy do mini wykresu (noc = dzień pobudki, ostatnia to dzisiejsza).
    listSleepLogs(format(addDays(parseISO(today), -6), "yyyy-MM-dd"), today),
  ]);
  if (!sleep.ok) throw new Error(sleep.error);

  // Zadania wczytujemy tylko dla bloków, które je mają (licznik z listOccurrences).
  const blocks: PlanBlock[] = await Promise.all(
    occurrences.map(async (occurrence) => {
      const category = categories.find((c) => c.id === occurrence.categoryId);
      return {
        key: `${occurrence.blockId}|${occurrence.occurrenceDate}`,
        title: occurrence.title,
        dot: categoryColor(category?.color ?? "gray").dot,
        categoryName: category?.name ?? null,
        start: formatInTimeZone(occurrence.start, profile.timezone, "HH:mm"),
        end: formatInTimeZone(occurrence.end, profile.timezone, "HH:mm"),
        isNow: occurrence.start <= now && now < occurrence.end,
        tasks: occurrence.taskTotal > 0 ? await listTasks(occurrence.blockId, occurrence.occurrenceDate) : [],
      };
    }),
  );

  // „Środa, 18 listopada” (miesiąc w dopełniaczu); `today` to już data w strefie profilu.
  const weekdayAndDate = new Date(`${today}T12:00:00Z`).toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <TodayView
      key={today}
      greeting={user?.firstName ? `Dzień dobry, ${user.firstName}` : "Dzień dobry"}
      heading={`${weekdayAndDate.charAt(0).toUpperCase()}${weekdayAndDate.slice(1)}`}
      today={today}
      timezone={profile.timezone}
      sleepGoalMin={profile.sleep_goal_min}
      initialBlocks={blocks}
      initialHabits={habits.map(toDTO)}
      sleepLogs={sleep.data}
    />
  );
}

export default function DzisPage() {
  return (
    <main className="px-7 pt-5 pb-8 max-md:px-4">
      <Suspense fallback={<p className="text-muted-foreground">Ładowanie…</p>}>
        <Today />
      </Suspense>
    </main>
  );
}
