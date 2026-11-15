"use client";

import { useState } from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { QUIET_BUTTON_DARK, QUIET_BUTTON_LIGHT, QUIET_CARD, QUIET_INPUT } from "@/components/calendar/quiet-classes";
import { validateHabitInput } from "@/lib/habits/rules";
import { scheduleOn } from "@/lib/habits/schedule";
import type { HabitHistory, ScheduleType } from "@/lib/habits/types";
import { previewNote, schedulePreview } from "@/lib/habits/view";
import { cn } from "@/lib/utils";

export type HabitInput = { name: string; type: ScheduleType; weekdays: number[]; timesPerWeek: number | null };

const MODES: { type: ScheduleType; label: string }[] = [
  { type: "daily", label: "Codziennie" },
  { type: "days", label: "Wybrane dni" },
  { type: "weekly", label: "X w tygodniu" },
  { type: "none", label: "Bez planu" },
];

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]; // ISO 1..7
const WEEKDAY_NAMES = ["poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];

type HabitDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  /** Tylko w trybie edycji: edytowany nawyk (harmonogram startuje od wersji obowiązującej dziś). */
  initial?: HabitHistory;
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD), od jutra liczy się podgląd. */
  today: string;
  /** Zapis; rzucony błąd zostaje pokazany w oknie, a okno zostaje otwarte. Zamyka je rodzic. */
  onSubmit: (input: HabitInput) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function HabitDialog({ open, mode, initial, today, onSubmit, onOpenChange }: HabitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className={cn("max-w-[500px]", QUIET_CARD)} closeProps={{ "aria-label": "Zamknij" }}>
        {/* Formularz montuje się przy każdym otwarciu, więc stan zawsze startuje od wartości początkowych. */}
        <HabitForm mode={mode} initial={initial} today={today} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} />
      </DialogPopup>
    </Dialog>
  );
}

type HabitFormProps = Pick<HabitDialogProps, "mode" | "initial" | "today" | "onSubmit"> & { onCancel: () => void };

function HabitForm({ mode, initial, today, onSubmit, onCancel }: HabitFormProps) {
  const initialSchedule = initial ? scheduleOn(initial, today) : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ScheduleType>(initialSchedule?.type ?? "daily");
  // Wartości trybów, które nie są wybrane, czekają w stanie, żeby przełączanie trybów ich nie gubiło.
  const [weekdays, setWeekdays] = useState<number[]>(
    initialSchedule?.type === "days" ? initialSchedule.weekdays : [1, 2, 3, 4, 5],
  );
  const [timesPerWeek, setTimesPerWeek] = useState(initialSchedule?.timesPerWeek ?? 3);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const draft = {
    type,
    weekdays: type === "days" ? weekdays : [],
    timesPerWeek: type === "weekly" ? timesPerWeek : null,
  };
  const scheduleChanged =
    initialSchedule !== null &&
    (initialSchedule.type !== draft.type ||
      initialSchedule.timesPerWeek !== draft.timesPerWeek ||
      initialSchedule.weekdays.join(",") !== draft.weekdays.join(","));
  const preview = schedulePreview(draft, today);

  const explanation = {
    daily: "Nawyk jest zaplanowany każdego dnia i liczy się do dziennego wyniku na heatmapie.",
    days: `Liczy się tylko w zaznaczone dni (${weekdays.length} w tygodniu). W pozostałe dni nie obniża wyniku.`,
    weekly: `Cel tygodniowy: odhacz ${timesPerWeek} razy w dowolne dni. Na liście zobaczysz postęp, np. „1 z ${timesPerWeek} w tym tyg.”. Nie obniża wyniku dnia, a odhaczony go podnosi.`,
    none: "Bez planu: odhaczasz, kiedy chcesz. Nie obniża wyniku dnia, a odhaczony go podnosi.",
  }[type];

  function toggleWeekday(weekday: number) {
    setWeekdays((current) =>
      current.includes(weekday)
        ? current.filter((day) => day !== weekday)
        : [...current, weekday].sort((a, b) => a - b),
    );
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Ta sama walidacja co na serwerze, żeby błędy (pusta nazwa, brak dni) pojawiały się od razu.
      const valid = validateHabitInput({ name, ...draft });
      await onSubmit({ name: valid.name, ...valid.schedule });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać nawyku");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
      <DialogHeader className="border-b border-[#EAEAE8] px-5 py-4 pb-4!">
        <DialogTitle className="font-sans text-base font-semibold text-[#191816]">
          {mode === "create" ? "Nowy nawyk" : "Edytuj nawyk"}
        </DialogTitle>
      </DialogHeader>

      <DialogPanel className="flex flex-col gap-[18px] px-5 pt-[18px]! pb-[18px]!">
        <Field>
          <FieldLabel className="text-[13px] font-medium text-[#37352F]">Nazwa</FieldLabel>
          <Input
            autoFocus
            className={QUIET_INPUT}
            value={name}
            maxLength={60}
            placeholder="np. Czytanie 20 min"
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </Field>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-1.5 text-[13px] font-medium text-[#37352F]">Jak często</legend>
          <div role="radiogroup" aria-label="Harmonogram" className="grid grid-cols-4 gap-0.5 rounded-lg bg-[#F4F4F3] p-0.5">
            {MODES.map((option) => {
              const checked = option.type === type;
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    setType(option.type);
                    setError(null);
                  }}
                  className={cn(
                    "h-[30px] truncate rounded-md border px-1.5 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    checked
                      ? "border-[#E6E6E4] bg-white text-[#191816] shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
                      : "border-transparent bg-transparent text-[#7D7C78] hover:text-[#37352F]",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {type === "days" && (
            <div className="flex gap-1.5" role="group" aria-label="Dni tygodnia">
              {WEEKDAYS.map((label, index) => {
                const weekday = index + 1;
                const pressed = weekdays.includes(weekday);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={pressed}
                    aria-label={WEEKDAY_NAMES[index]}
                    onClick={() => toggleWeekday(weekday)}
                    className={cn(
                      "h-[34px] flex-1 rounded-lg border text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      pressed
                        ? "border-[#191816] bg-[#191816] text-white"
                        : "border-[#E6E6E4] bg-white text-[#7D7C78] hover:bg-[#F7F7F6]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {type === "weekly" && (
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                aria-label="Mniej"
                className={cn(QUIET_BUTTON_LIGHT, "w-8 px-0")}
                disabled={timesPerWeek <= 1}
                onClick={() => setTimesPerWeek((times) => Math.max(1, times - 1))}
              >
                <MinusIcon aria-hidden="true" />
              </Button>
              <span className="min-w-6 text-center text-base font-semibold tabular-nums" aria-live="polite">
                {timesPerWeek}
              </span>
              <Button
                type="button"
                aria-label="Więcej"
                className={cn(QUIET_BUTTON_LIGHT, "w-8 px-0")}
                disabled={timesPerWeek >= 7}
                onClick={() => setTimesPerWeek((times) => Math.min(7, times + 1))}
              >
                <PlusIcon aria-hidden="true" />
              </Button>
              <span className="text-[13px] text-[#7D7C78]">razy w tygodniu, w dowolne dni</span>
            </div>
          )}

          <p className="rounded-lg border border-[#F0F0EE] bg-[#FBFBFA] px-2.5 py-2 text-xs leading-normal text-[#7D7C78]">
            {explanation}
          </p>
          {mode === "edit" && scheduleChanged && (
            <p className="text-xs text-[#7D7C78]">Zmiana obowiązuje od dziś. Wcześniejsze dni zostają bez zmian.</p>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-[#37352F]">Najbliższe 2 tygodnie</span>
          <ol className="grid grid-cols-14 gap-1" aria-label="Podgląd najbliższych 14 dni">
            {preview.map((day) => (
              <li key={day.date} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#9B9A97]">{day.weekday}</span>
                <span
                  title={day.kind === "planned" ? "zaplanowany" : day.kind === "loose" ? "dowolny dzień" : "bez planu"}
                  className={cn(
                    "box-border flex size-[26px] items-center justify-center rounded-full text-[11px]",
                    day.kind === "planned" && "bg-[#3E9B63] font-medium text-white",
                    day.kind === "loose" && "border border-dashed border-[#AEDABB] bg-white text-[#37352F]",
                    day.kind === "off" && "bg-[#F4F4F3] text-[#9B9A97]",
                  )}
                >
                  {day.dayOfMonth}
                </span>
              </li>
            ))}
          </ol>
          <span className="text-xs text-[#9B9A97]">{previewNote(draft, today)}</span>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive-foreground">
            {error}
          </p>
        )}
      </DialogPanel>

      <DialogFooter variant="bare" className="border-t border-[#EAEAE8] px-5 pt-3.5! pb-3.5!">
        <Button type="button" className={QUIET_BUTTON_LIGHT} onClick={onCancel}>
          Anuluj
        </Button>
        <Button type="submit" className={QUIET_BUTTON_DARK} disabled={saving}>
          {mode === "create" ? "Utwórz nawyk" : "Zapisz"}
        </Button>
      </DialogFooter>
    </form>
  );
}
