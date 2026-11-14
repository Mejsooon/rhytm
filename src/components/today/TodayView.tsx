"use client";

import { useState } from "react";
import { toggleTask, type BlockTask } from "@/app/(app)/kalendarz/actions";
import { setHabitCheck } from "@/app/(app)/nawyki/habit-actions";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { dayScore } from "@/lib/habits/schedule";
import { fromDTO, type HabitHistory, type HabitHistoryDTO } from "@/lib/habits/types";
import type { SleepLog } from "@/lib/sleep/sleep";
import { SummaryStrip } from "./SummaryStrip";
import { TodayHabits } from "./TodayHabits";
import { TodayPlan, type PlanBlock } from "./TodayPlan";
import { TodaySleep } from "./TodaySleep";

type TodayViewProps = {
  /** „Dzień dobry, Mejson” albo samo „Dzień dobry”. */
  greeting: string;
  /** „Środa, 18 listopada”. */
  heading: string;
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD). */
  today: string;
  timezone: string;
  sleepGoalMin: number;
  /** Dzisiejsze bloki z zadaniami, w kolejności godzin; dalej żyją w stanie klienta. */
  initialBlocks: PlanBlock[];
  /** Nawyki istniejące dziś (z odhaczeniami do serii); dalej żyją w stanie klienta. */
  initialHabits: HabitHistoryDTO[];
  /** Wpisy snu z ostatnich 7 nocy. */
  sleepLogs: SleepLog[];
};

/**
 * Ekran „Dziś”: nagłówek, pasek podsumowania, plan dnia oraz nawyki i sen. Stan zadań i nawyków jest tutaj,
 * bo pasek podsumowania liczy się z tych samych danych co listy. Odhaczanie jest optymistyczne
 * (przy błędzie cofnięcie + toast).
 */
export function TodayView({
  greeting,
  heading,
  today,
  timezone,
  sleepGoalMin,
  initialBlocks,
  initialHabits,
  sleepLogs,
}: TodayViewProps) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [habits, setHabits] = useState(() => initialHabits.map(fromDTO));

  const allTasks = blocks.flatMap((block) => block.tasks);
  const tasksDone = allTasks.filter((task) => task.done).length;
  const habitScore = dayScore(habits, today);
  const lastNight = sleepLogs.find((log) => log.date === today) ?? null;

  function setTaskDone(id: string, done: boolean) {
    setBlocks((list) =>
      list.map((block) => ({
        ...block,
        tasks: block.tasks.map((task) => (task.id === id ? { ...task, done } : task)),
      })),
    );
  }

  // toggleTask (z etapu 1) rzuca błąd zamiast zwracać ActionResult; w produkcji jego treść jest ukryta.
  async function onToggleTask(task: BlockTask, done: boolean) {
    setTaskDone(task.id, done);
    try {
      await toggleTask(task.id, done);
    } catch {
      setTaskDone(task.id, !done);
      toastManager.add({ type: "error", title: "Nie udało się zapisać zadania" });
    }
  }

  function setChecked(id: string, done: boolean) {
    setHabits((list) =>
      list.map((habit) => {
        if (habit.id !== id) return habit;
        const checks = new Set(habit.checks);
        if (done) checks.add(today);
        else checks.delete(today);
        return { ...habit, checks };
      }),
    );
  }

  async function onToggleHabit(habit: HabitHistory, done: boolean) {
    setChecked(habit.id, done);
    const result = await setHabitCheck(habit.id, today, done).catch(() => null);
    if (result?.ok) return;
    setChecked(habit.id, !done);
    toastManager.add({ type: "error", title: "Nie udało się zapisać odhaczenia", description: result?.error });
  }

  return (
    <ToastProvider>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-[#9B9A97]">{greeting}</span>
          <h1 className="text-[22px] font-semibold text-[#191816]">{heading}</h1>
        </div>

        <SummaryStrip
          tasks={{ done: tasksDone, total: allTasks.length }}
          habits={habitScore}
          lastNight={lastNight}
          timezone={timezone}
          sleepGoalMin={sleepGoalMin}
        />

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(320px,5fr)]">
          <TodayPlan blocks={blocks} onToggleTask={(task, done) => void onToggleTask(task, done)} />
          <div className="flex flex-col gap-4">
            <TodayHabits habits={habits} today={today} onToggle={(habit, done) => void onToggleHabit(habit, done)} />
            <TodaySleep logs={sleepLogs} today={today} timezone={timezone} goalMin={sleepGoalMin} />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
