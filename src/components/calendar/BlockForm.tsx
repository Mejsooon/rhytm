"use client";

import { useState } from "react";
import { ClockIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formDurationMin, type BlockFormValue, type RepeatMode } from "@/lib/calendar/block-form";
import { CATEGORY_COLORS } from "@/lib/calendar/colors";
import type { Weekday } from "@/lib/calendar/types";
import { cn } from "@/lib/utils";

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
  /** Zapis; rzucony błąd (np. z walidacji serwera) zostaje pokazany w formularzu, a dialog się nie zamyka. */
  onSubmit: (value: BlockFormValue) => Promise<void>;
  /** Tylko w trybie edycji: przycisk „Usuń”. */
  onDelete?: () => void;
  onOpenChange: (open: boolean) => void;
};

export function BlockForm({ open, mode, initialValue, onSubmit, onDelete, onOpenChange }: BlockFormProps) {
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
      <DialogPopup className="max-w-[520px]">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nowy blok" : "Edytuj blok"}</DialogTitle>
          </DialogHeader>

          <DialogPanel className="flex flex-col gap-5">
            <Field>
              <FieldLabel>Nazwa</FieldLabel>
              <Input
                autoFocus
                required
                value={value.title}
                onChange={(event) => setValue({ ...value, title: event.target.value })}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm">
              <ClockIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              <Input
                type="date"
                aria-label="Data"
                required
                className="w-auto"
                value={value.date}
                onChange={(event) => setValue({ ...value, date: event.target.value })}
              />
              <span className="ml-auto flex items-center gap-1.5 font-mono">
                <Input
                  type="time"
                  aria-label="Początek"
                  required
                  className="w-auto"
                  value={value.startTime}
                  onChange={(event) => setValue({ ...value, startTime: event.target.value })}
                />
                –
                <Input
                  type="time"
                  aria-label="Koniec"
                  required
                  className="w-auto"
                  value={value.endTime}
                  onChange={(event) => setValue({ ...value, endTime: event.target.value })}
                />
              </span>
              <span className="text-xs text-muted-foreground">{durationLabel}</span>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Kategoria</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((category) => {
                  const selected = value.color === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setValue({ ...value, color: category.id })}
                      className={cn(
                        "flex h-[34px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "border-[1.5px]" : "border-input bg-background text-foreground/80",
                      )}
                      style={selected ? { background: category.bg, borderColor: category.bar, color: category.ink } : undefined}
                    >
                      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: category.bar }} />
                      {category.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Powtarzanie także przy edycji: zmiana zapisuje się tylko dla „To i następne” albo „Wszystkie”. */}
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2 text-sm font-medium">Powtarzanie</legend>
              <SegmentedControl aria-label="Powtarzanie" className="w-full">
                {REPEAT_OPTIONS.map((option) => (
                  <SegmentedControlItem
                    key={option.value}
                    className="flex-1"
                    aria-pressed={value.repeat === option.value}
                    data-checked={value.repeat === option.value ? "" : undefined}
                    onClick={() => setValue({ ...value, repeat: option.value })}
                  >
                    {option.label}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>

              {value.repeat === "custom" && (
                <ToggleGroup
                  multiple
                  variant="outline"
                  aria-label="Dni tygodnia"
                  className="flex-wrap gap-1.5"
                  value={value.weekdays.map(String)}
                  onValueChange={(days: string[]) =>
                    setValue({ ...value, weekdays: days.map(Number).sort() as Weekday[] })
                  }
                >
                  {WEEKDAYS.map((day) => (
                    <ToggleGroupItem
                      key={day.value}
                      value={String(day.value)}
                      aria-label={day.full}
                      className="w-10 data-pressed:bg-primary data-pressed:text-primary-foreground"
                    >
                      {day.short}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}

              {value.repeat !== "none" && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex min-h-9 items-center gap-2.5 text-sm">
                    <Checkbox checked={hasEnd} onCheckedChange={(checked) => setHasEnd(checked === true)} />
                    Kończy się
                    {!hasEnd && <span className="text-muted-foreground">— bez daty końca</span>}
                  </label>
                  {hasEnd && (
                    <Input
                      type="date"
                      aria-label="Data końca"
                      required
                      // Przy edycji efektywny start zależy od zakresu (np. „Wszystkie” = start serii), więc sprawdza go serwer.
                      min={mode === "create" ? value.date : undefined}
                      className="w-auto"
                      value={value.until}
                      onChange={(event) => setValue({ ...value, until: event.target.value })}
                    />
                  )}
                </div>
              )}
            </fieldset>

            <Field>
              <FieldLabel>
                Notatka <span className="font-normal text-muted-foreground">(opcjonalnie)</span>
              </FieldLabel>
              <Textarea
                rows={2}
                className="resize-none"
                value={value.note}
                onChange={(event) => setValue({ ...value, note: event.target.value })}
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm text-destructive-foreground">
                {error}
              </p>
            )}
          </DialogPanel>

          <DialogFooter variant="bare">
            {mode === "edit" && onDelete && (
              <Button type="button" variant="destructive-outline" className="sm:mr-auto" onClick={onDelete}>
                <TrashIcon aria-hidden="true" />
                Usuń
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {mode === "create" ? "Utwórz blok" : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
