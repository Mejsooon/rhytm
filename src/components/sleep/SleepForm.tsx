"use client";

import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { deleteSleepLog, saveSleepLog } from "@/app/(app)/nawyki/sleep-actions";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  QUIET_BUTTON_DANGER,
  QUIET_BUTTON_DARK,
  QUIET_BUTTON_DESTRUCTIVE,
  QUIET_BUTTON_LIGHT,
  QUIET_CARD,
  QUIET_INPUT,
  QUIET_LABEL,
} from "@/components/calendar/quiet-classes";
import { formatMinutes, sleepMinutes, validateSleepInput, type SleepLog } from "@/lib/sleep/sleep";
import { cn } from "@/lib/utils";

const FEELINGS = [1, 2, 3, 4, 5];
const TIME_PATTERN = /^\d{2}:\d{2}$/;

type SleepFormProps = {
  /** Dzień pobudki (YYYY-MM-DD), czyli oglądany dzień `?d=`. */
  date: string;
  today: string;
  timezone: string;
  /** Istniejący wpis z tego dnia albo undefined (pusty formularz). */
  log: SleepLog | undefined;
  onSaved: (log: SleepLog) => void;
  onDeleted: (date: string) => void;
};

/** „Noc 17 → 18 listopada”, a na przełomie miesięcy „Noc 31 października → 1 listopada”. */
function nightTitle(date: string): string {
  const previous = format(addDays(parseISO(date), -1), "yyyy-MM-dd");
  const longDate = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "UTC" });
  const start = previous.slice(0, 7) === date.slice(0, 7) ? String(Number(previous.slice(8))) : longDate(previous);
  return `Noc ${start} → ${longDate(date)}`;
}

/**
 * Wpis snu z nocy kończącej się w oglądanym dniu: godziny zaśnięcia i pobudki (czas snu liczony na żywo
 * w strefie profilu), samopoczucie 1–5, notatka. „Usuń” tylko przy istniejącym wpisie, z potwierdzeniem.
 */
export function SleepForm({ date, today, timezone, log, onSaved, onDeleted }: SleepFormProps) {
  const [sleptAt, setSleptAt] = useState(log?.sleptAt ?? "23:00");
  const [wokeAt, setWokeAt] = useState(log?.wokeAt ?? "07:00");
  const [feeling, setFeeling] = useState<number | null>(log?.feeling ?? null);
  const [note, setNote] = useState(log?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const minutes =
    TIME_PATTERN.test(sleptAt) && TIME_PATTERN.test(wokeAt) ? sleepMinutes(date, sleptAt, wokeAt, timezone) : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (feeling === null) {
      setError("Wybierz samopoczucie");
      return;
    }
    const input = { date, sleptAt, wokeAt, feeling, note };
    try {
      validateSleepInput(input, timezone, today);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieprawidłowe dane");
      return;
    }

    setPending(true);
    const result = await saveSleepLog(input).catch(() => null);
    setPending(false);
    if (result === null) setError("Nie udało się zapisać snu. Spróbuj ponownie.");
    else if (!result.ok) setError(result.error);
    else {
      setError(null);
      onSaved(result.data);
    }
  }

  async function handleDelete() {
    setConfirming(false);
    setPending(true);
    const result = await deleteSleepLog(date).catch(() => null);
    setPending(false);
    if (result === null) setError("Nie udało się usunąć snu. Spróbuj ponownie.");
    else if (!result.ok) setError(result.error);
    else {
      setSleptAt("23:00");
      setWokeAt("07:00");
      setFeeling(null);
      setNote("");
      setError(null);
      onDeleted(date);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Wpis snu"
      className="flex flex-col gap-3.5 rounded-xl border border-[#EAEAE8] bg-white p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <strong className="text-sm font-medium">{nightTitle(date)}</strong>
        <span className="text-sm text-[#37352F] tabular-nums" aria-live="polite">
          {minutes === null ? "—" : formatMinutes(Math.max(minutes, 0))}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field className="gap-1.5">
          <FieldLabel className={QUIET_LABEL}>Zasnąłem</FieldLabel>
          <Input
            type="time"
            required
            size="lg"
            className={QUIET_INPUT}
            value={sleptAt}
            onChange={(event) => {
              setSleptAt(event.target.value);
              setError(null);
            }}
          />
        </Field>
        <Field className="gap-1.5">
          <FieldLabel className={QUIET_LABEL}>Obudziłem się</FieldLabel>
          <Input
            type="time"
            required
            size="lg"
            className={QUIET_INPUT}
            value={wokeAt}
            onChange={(event) => {
              setWokeAt(event.target.value);
              setError(null);
            }}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col">
        <legend className={cn(QUIET_LABEL, "mb-1.5 p-0")}>Samopoczucie po przebudzeniu</legend>
        <div role="radiogroup" aria-label="Samopoczucie" className="flex gap-0.5 rounded-lg bg-[#F4F4F3] p-0.5">
          {FEELINGS.map((value) => {
            const checked = value === feeling;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => {
                  setFeeling(value);
                  setError(null);
                }}
                className={cn(
                  "h-8 flex-1 rounded-md border text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  checked
                    ? "border-[#E6E6E4] bg-white text-[#191816] shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
                    : "border-transparent bg-transparent text-[#7D7C78] hover:text-[#37352F]",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-xs text-[#9B9A97]">
          <span>fatalnie</span>
          <span>świetnie</span>
        </div>
      </fieldset>

      <Field className="gap-1.5">
        <FieldLabel className={QUIET_LABEL}>
          Notatka <span className="font-normal text-[#9B9A97]">(opcjonalnie)</span>
        </FieldLabel>
        <Textarea
          rows={2}
          maxLength={500}
          className={cn(QUIET_INPUT, "[&_textarea]:resize-y [&_textarea]:px-2.5 [&_textarea]:py-2")}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError(null);
          }}
        />
      </Field>

      {error && (
        <p role="alert" className="text-[13px] text-destructive-foreground">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" className={QUIET_BUTTON_DARK} disabled={pending}>
          Zapisz
        </Button>
        {log && (
          <Button type="button" className={QUIET_BUTTON_DANGER} disabled={pending} onClick={() => setConfirming(true)}>
            Usuń
          </Button>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogPopup className={cn("max-w-[400px]", QUIET_CARD)}>
          <div className="flex flex-col gap-3.5 p-5">
            <AlertDialogTitle className="font-sans text-base leading-6 font-semibold text-[#191816]">
              Usunąć wpis snu z tej nocy?
            </AlertDialogTitle>
            <div className="flex justify-end gap-2">
              <AlertDialogClose render={<Button type="button" className={QUIET_BUTTON_LIGHT} />}>Anuluj</AlertDialogClose>
              <Button type="button" className={QUIET_BUTTON_DESTRUCTIVE} onClick={() => void handleDelete()}>
                Usuń
              </Button>
            </div>
          </div>
        </AlertDialogPopup>
      </AlertDialog>
    </form>
  );
}
