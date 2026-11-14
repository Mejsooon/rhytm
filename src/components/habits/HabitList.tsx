"use client";

import { useState } from "react";
import { CircleCheckIcon, PlusIcon } from "lucide-react";
import { archiveHabit, createHabit, setHabitCheck, updateHabit } from "@/app/(app)/nawyki/habit-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { QUIET_BUTTON_DARK } from "@/components/calendar/quiet-classes";
import { dayScore, scheduleLabel } from "@/lib/habits/schedule";
import { fromDTO, type HabitHistory, type HabitHistoryDTO } from "@/lib/habits/types";
import { dayRows, dayTitle } from "@/lib/habits/view";
import type { SleepLog } from "@/lib/sleep/sleep";
import { SleepChart } from "@/components/sleep/SleepChart";
import { SleepForm } from "@/components/sleep/SleepForm";
import { cn } from "@/lib/utils";
import { DayNav } from "./DayNav";
import { HabitHeatmap } from "./HabitHeatmap";
import { HabitDetail } from "./HabitDetail";
import { HabitDialog, type HabitInput } from "./HabitDialog";

type HabitListProps = {
  /** Nawyki wczytane na serwerze (z odhaczeniami z ostatnich ~2 lat); dalej żyją w stanie klienta. */
  initialHabits: HabitHistoryDTO[];
  /** Oglądany dzień (YYYY-MM-DD), nigdy po `today`. */
  date: string;
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD). */
  today: string;
  /** Wpisy snu z ostatnich 53 tygodni (+ wpis oglądanego dnia, jeśli starszy); dalej żyją w stanie klienta. */
  initialSleepLogs: SleepLog[];
  /** Strefa z profilu (długość snu przez północ i zmianę czasu). */
  timezone: string;
  /** Cel snu z profilu w minutach (linia celu na wykresie). */
  sleepGoalMin: number;
};

type DialogState = { mode: "create" } | { mode: "edit"; habit: HabitHistory } | null;

// Błąd oczekiwany przychodzi z akcji jako wartość (czytelny komunikat). Rzucony błąd to awaria
// (sieć, sesja); w produkcji Next.js ukrywa jego treść, więc pokazujemy tylko tytuł.
function showError(title: string, description?: string) {
  toastManager.add({ type: "error", title, description });
}

/**
 * Strona „Nawyki i sen”: nagłówek z nawigacją dnia, lista nawyków wybranego dnia, okno nawyku
 * i szuflada szczegółów, pod nimi heatmapa nawyków i sekcja „Sen” (wpis oglądanego dnia + wykres). Odhaczenia i archiwizacja są optymistyczne (przy błędzie cofnięcie + toast).
 */
export function HabitList({ initialHabits, date, today, initialSleepLogs, timezone, sleepGoalMin }: HabitListProps) {
  const [habits, setHabits] = useState(() => initialHabits.map(fromDTO));
  const [sleepLogs, setSleepLogs] = useState(initialSleepLogs);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = dayRows(habits, date, today);
  const score = dayScore(habits, date);
  const detailHabit = habits.find((habit) => habit.id === detailId);
  const hasActiveHabits = habits.some((habit) => habit.archivedOn === null || habit.archivedOn > today);

  function setChecked(id: string, done: boolean) {
    setHabits((list) =>
      list.map((habit) => {
        if (habit.id !== id) return habit;
        const checks = new Set(habit.checks);
        if (done) checks.add(date);
        else checks.delete(date);
        return { ...habit, checks };
      }),
    );
  }

  async function toggle(habit: HabitHistory, done: boolean) {
    setChecked(habit.id, done);
    const result = await setHabitCheck(habit.id, date, done).catch(() => null);
    if (result?.ok) return;
    setChecked(habit.id, !done);
    showError("Nie udało się zapisać odhaczenia", result?.error);
  }

  // Zapis z okna nawyku. Błąd leci dalej jako Error z komunikatem: okno pokazuje go i zostaje otwarte.
  async function submitHabit(input: HabitInput) {
    if (!dialog) return;
    const result = await (dialog.mode === "create" ? createHabit(input) : updateHabit(dialog.habit.id, input)).catch(
      () => null,
    );
    if (result === null) throw new Error("Nie udało się zapisać nawyku. Spróbuj ponownie.");
    if (!result.ok) throw new Error(result.error);

    if (dialog.mode === "create") {
      const created = fromDTO(result.data);
      setHabits((list) => [...list, created]);
    } else {
      const updated = fromDTO(result.data);
      // updateHabit zwraca odhaczenia tylko z ostatnich 53 tygodni, więc dokładamy starsze, które klient już ma.
      setHabits((list) =>
        list.map((habit) =>
          habit.id === updated.id ? { ...updated, checks: new Set([...habit.checks, ...updated.checks]) } : habit,
        ),
      );
    }
    setDialog(null);
  }

  async function archive(habit: HabitHistory) {
    setDetailId(null);
    setHabits((list) => list.map((h) => (h.id === habit.id ? { ...h, archivedOn: today } : h)));
    const result = await archiveHabit(habit.id).catch(() => null);
    if (result?.ok) return;
    setHabits((list) => list.map((h) => (h.id === habit.id ? { ...h, archivedOn: habit.archivedOn } : h)));
    showError("Nie udało się zarchiwizować nawyku", result?.error);
  }

  const newHabitButton = (
    <Button className={QUIET_BUTTON_DARK} onClick={() => setDialog({ mode: "create" })}>
      <PlusIcon aria-hidden="true" />
      Nowy nawyk
    </Button>
  );

  return (
    <ToastProvider>
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold text-[#191816]">Nawyki i sen</h1>
          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <DayNav date={date} today={today} />
            {newHabitButton}
          </div>
        </div>

        {!hasActiveHabits && rows.length === 0 ? (
          <section className="flex flex-col items-center gap-2.5 rounded-xl border border-[#EAEAE8] bg-white px-4 py-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-[#F4F4F3]">
              <CircleCheckIcon aria-hidden="true" className="size-[18px] text-[#7D7C78]" />
            </span>
            <strong className="text-[15px] font-semibold">Nie masz jeszcze nawyków</strong>
            <p className="max-w-[380px] text-[13px] leading-normal text-[#7D7C78]">
              Zacznij od jednego. Możesz go robić codziennie, w wybrane dni albo kilka razy w tygodniu.
            </p>
            <div className="mt-1">{newHabitButton}</div>
          </section>
        ) : (
          <section
            aria-label={date === today ? "Dzisiejsze nawyki" : "Nawyki tego dnia"}
            className="overflow-hidden rounded-xl border border-[#EAEAE8] bg-white"
          >
            <div className="flex items-center gap-3 border-b border-[#EAEAE8] px-4 py-3.5">
              <strong className="text-sm font-medium">{dayTitle(date, today)}</strong>
              <span className="text-[13px] whitespace-nowrap text-[#7D7C78]">
                {score.done} z {score.total} zaplanowanych
              </span>
              <span
                className="ms-auto flex h-1 w-[120px] overflow-hidden rounded-sm bg-[#F0F0EE] max-sm:hidden"
                role="progressbar"
                aria-label="Wynik dnia"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score.pct ?? undefined}
              >
                <span className="h-full rounded-sm bg-[#37352F] transition-[width]" style={{ width: `${score.pct ?? 0}%` }} />
              </span>
              <span className="min-w-9 text-end text-[13px] max-sm:ms-auto font-medium text-[#37352F] tabular-nums">
                {score.pct === null ? "—" : `${score.pct}%`}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-[#9B9A97]">Tego dnia nie było jeszcze żadnego nawyku.</p>
            ) : (
              <ul>
                {rows.map((row) => (
                  <li
                    key={row.habit.id}
                    className={cn(
                      "flex min-h-12 items-center gap-3 border-t border-[#F0F0EE] px-4 py-1.5 first:border-t-0",
                      row.offDay && "opacity-60",
                    )}
                  >
                    <Checkbox
                      className="size-[22px] md:size-4"
                      aria-label={row.habit.name}
                      checked={row.checked}
                      onCheckedChange={(checked) => void toggle(row.habit, checked === true)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-px">
                      <button
                        type="button"
                        className={cn(
                          "min-w-0 truncate text-start text-sm outline-none hover:underline focus-visible:underline",
                          row.checked && "text-[#9B9A97] line-through",
                        )}
                        onClick={() => setDetailId(row.habit.id)}
                      >
                        {row.habit.name}
                      </button>
                      <span className="text-xs text-[#9B9A97]">{scheduleLabel(row.schedule)}</span>
                    </div>
                    {row.meta && <span className="shrink-0 text-xs text-[#7D7C78]">{row.meta}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Heatmapa liczy się z tego samego stanu `habits`, więc odhaczenie od razu zmienia kolor dnia. */}
        {habits.length > 0 && <HabitHeatmap habits={habits} today={today} />}

        <h2 className="mt-2 text-base font-semibold text-[#191816]">Sen</h2>
        <SleepForm
          date={date}
          today={today}
          timezone={timezone}
          log={sleepLogs.find((log) => log.date === date)}
          onSaved={(saved) =>
            setSleepLogs((logs) => [...logs.filter((log) => log.date !== saved.date), saved])
          }
          onDeleted={(deleted) => setSleepLogs((logs) => logs.filter((log) => log.date !== deleted))}
        />
        <SleepChart logs={sleepLogs} today={today} timezone={timezone} goalMin={sleepGoalMin} />
      </div>

      {detailHabit && (
        <HabitDetail
          key={detailHabit.id}
          habit={detailHabit}
          today={today}
          onEdit={() => {
            setDetailId(null);
            setDialog({ mode: "edit", habit: detailHabit });
          }}
          onArchive={() => void archive(detailHabit)}
          onClose={() => setDetailId(null)}
        />
      )}

      {dialog && (
        <HabitDialog
          open
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.habit : undefined}
          today={today}
          onSubmit={submitHabit}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      )}
    </ToastProvider>
  );
}
