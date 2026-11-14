"use client";

import { useState } from "react";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formDurationMin, type BlockFormValue, type RepeatMode } from "@/lib/calendar/block-form";
import { categoryColor } from "@/lib/calendar/colors";
import type { Weekday } from "@/lib/calendar/types";
import type { Category } from "@/lib/categories/categories";
import { cn } from "@/lib/utils";
import {
  QUIET_BUTTON_DANGER,
  QUIET_BUTTON_DARK,
  QUIET_BUTTON_LIGHT,
  QUIET_CARD,
  QUIET_INPUT,
  QUIET_LABEL,
} from "./quiet-classes";

const REPEAT_OPTIONS: { value: RepeatMode; label: string }[] = [
  { value: "none", label: "Nie" },
  { value: "daily", label: "Codziennie" },
  { value: "weekdays", label: "Dni robocze" },
  { value: "weekly", label: "Co tydzień" },
  { value: "custom", label: "Wybrane" },
];

const WEEKDAYS: { value: Weekday; short: string; full: string }[] = [
  { value: 1, short: "Pn", full: "Poniedziałek" },
  { value: 2, short: "Wt", full: "Wtorek" },
  { value: 3, short: "Śr", full: "Środa" },
  { value: 4, short: "Cz", full: "Czwartek" },
  { value: 5, short: "Pt", full: "Piątek" },
  { value: 6, short: "So", full: "Sobota" },
  { value: 7, short: "Nd", full: "Niedziela" },
];

type BlockFormProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValue: BlockFormValue;
  /** Kategorie użytkownika do pola „Kategoria” (kolejność jak w menu). */
  categories: Category[];
  /** Zapis; rzucony błąd (np. z walidacji serwera) zostaje pokazany w formularzu, a dialog się nie zamyka. */
  onSubmit: (value: BlockFormValue) => Promise<void>;
  /** Tylko w trybie edycji: przycisk „Usuń”. */
  onDelete?: () => void;
  onOpenChange: (open: boolean) => void;
};

export function BlockForm({ open, mode, initialValue, categories, onSubmit, onDelete, onOpenChange }: BlockFormProps) {
  const [value, setValue] = useState(initialValue);
  const [hasEnd, setHasEnd] = useState(initialValue.until !== "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Czas trwania do podglądu w wierszu daty; przy błędnych godzinach pokazujemy pusty napis.
  let durationLabel = "";
  try {
    const minutes = formDurationMin(value);
    durationLabel = minutes % 60 === 0 ? `${minutes / 60} h` : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  } catch {
    durationLabel = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...value, until: hasEnd ? value.until : "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać bloku");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        className={cn("max-w-[480px]", QUIET_CARD)}
        closeProps={{ "aria-label": "Zamknij" }}
      >
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <div className="border-b border-[#EAEAE8] px-5 py-3 pe-14">
            <DialogTitle className="font-sans text-base leading-6 font-semibold text-[#191816]">
              {mode === "create" ? "Nowy blok" : "Edytuj blok"}
            </DialogTitle>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-[18px]">
            <Field className="gap-1.5">
              <FieldLabel className={QUIET_LABEL}>Nazwa</FieldLabel>
              <Input
                autoFocus
                required
                size="lg"
                className={QUIET_INPUT}
                value={value.title}
                onChange={(event) => setValue({ ...value, title: event.target.value })}
              />
            </Field>

            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2.5">
              <Field className="gap-1.5">
                <FieldLabel className={QUIET_LABEL}>Data</FieldLabel>
                <Input
                  type="date"
                  required
                  size="lg"
                  className={QUIET_INPUT}
                  value={value.date}
                  onChange={(event) => setValue({ ...value, date: event.target.value })}
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className={QUIET_LABEL}>Od</FieldLabel>
                <Input
                  type="time"
                  required
                  size="lg"
                  className={QUIET_INPUT}
                  value={value.startTime}
                  onChange={(event) => setValue({ ...value, startTime: event.target.value })}
                />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel className={QUIET_LABEL}>Do</FieldLabel>
                <Input
                  type="time"
                  required
                  size="lg"
                  className={QUIET_INPUT}
                  value={value.endTime}
                  onChange={(event) => setValue({ ...value, endTime: event.target.value })}
                />
              </Field>
              {durationLabel && <p className="col-span-3 -mt-1.5 text-xs text-[#9B9A97]">Czas trwania: {durationLabel}</p>}
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className={cn(QUIET_LABEL, "mb-1.5 p-0")}>Kategoria</legend>
              <RadioGroupPrimitive
                aria-label="Kategoria"
                value={value.categoryId}
                onValueChange={(categoryId) => setValue({ ...value, categoryId: categoryId as string })}
                className="flex flex-row flex-wrap gap-1.5"
              >
                {categories.map((category) => {
                  const checked = category.id === value.categoryId;
                  return (
                    <RadioPrimitive.Root
                      key={category.id}
                      value={category.id}
                      className={cn(
                        "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border bg-white px-2.5 text-[13px] font-medium whitespace-nowrap text-[#37352F] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                        checked ? "border-[#37352F]" : "border-[#E6E6E4]",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: categoryColor(category.color).dot }}
                      />
                      {category.name}
                    </RadioPrimitive.Root>
                  );
                })}
              </RadioGroupPrimitive>
            </fieldset>

            {/* Powtarzanie także przy edycji: zmiana zapisuje się tylko dla „To i następne” albo „Wszystkie”. */}
            <fieldset className="flex flex-col gap-2">
              <legend className={cn(QUIET_LABEL, "mb-1.5 p-0")}>Powtarzanie</legend>
              <div role="group" aria-label="Powtarzanie" className="flex gap-0.5 rounded-lg bg-[#F4F4F3] p-0.5">
                {REPEAT_OPTIONS.map((option) => {
                  const active = value.repeat === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        "h-7 flex-auto rounded-md border px-2 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "border-[#E6E6E4] bg-white text-[#191816] shadow-[0_1px_1px_rgba(0,0,0,0.04)]"
                          : "border-transparent bg-transparent text-[#7D7C78] hover:text-[#191816]",
                      )}
                      onClick={() => setValue({ ...value, repeat: option.value })}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {value.repeat === "custom" && (
                <div role="group" aria-label="Dni tygodnia" className="flex flex-wrap gap-1">
                  {WEEKDAYS.map((day) => {
                    const active = value.weekdays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={active}
                        aria-label={day.full}
                        className={cn(
                          "h-[30px] w-[34px] rounded-md border text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "border-[#37352F] bg-[#37352F] text-white"
                            : "border-[#E6E6E4] bg-white text-[#7D7C78] hover:text-[#191816]",
                        )}
                        onClick={() =>
                          setValue({
                            ...value,
                            weekdays: (active
                              ? value.weekdays.filter((d) => d !== day.value)
                              : [...value.weekdays, day.value]
                            ).sort() as Weekday[],
                          })
                        }
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
              )}

              {value.repeat !== "none" && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-9 items-center gap-2 text-[13px] text-[#37352F]">
                    <Checkbox checked={hasEnd} onCheckedChange={(checked) => setHasEnd(checked === true)} />
                    Kończy się
                    {!hasEnd && <span className="text-[#9B9A97]">— bez daty końca</span>}
                  </label>
                  {hasEnd && (
                    <Input
                      type="date"
                      aria-label="Data końca"
                      required
                      size="lg"
                      // Przy edycji efektywny start zależy od zakresu (np. „Wszystkie” = start serii), więc sprawdza go serwer.
                      min={mode === "create" ? value.date : undefined}
                      className={cn(QUIET_INPUT, "w-auto")}
                      value={value.until}
                      onChange={(event) => setValue({ ...value, until: event.target.value })}
                    />
                  )}
                </div>
              )}
            </fieldset>

            <Field className="gap-1.5">
              <FieldLabel className={QUIET_LABEL}>
                Notatka <span className="font-normal text-[#9B9A97]">(opcjonalnie)</span>
              </FieldLabel>
              <Textarea
                rows={2}
                className={cn(QUIET_INPUT, "[&_textarea]:resize-none [&_textarea]:px-2.5 [&_textarea]:py-2")}
                value={value.note}
                onChange={(event) => setValue({ ...value, note: event.target.value })}
              />
            </Field>

            {error && (
              <p role="alert" className="text-[13px] text-destructive-foreground">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-[#EAEAE8] bg-[#FCFCFB] px-5 py-3.5">
            {mode === "edit" && onDelete && (
              <Button type="button" className={cn(QUIET_BUTTON_DANGER, "mr-auto")} onClick={onDelete}>
                <TrashIcon aria-hidden="true" />
                Usuń
              </Button>
            )}
            <Button type="button" className={QUIET_BUTTON_LIGHT} onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" className={QUIET_BUTTON_DARK} disabled={saving}>
              {mode === "create" ? "Utwórz blok" : "Zapisz"}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
