"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import type { Scope } from "@/lib/calendar/plan-edit";

const SCOPES: { value: Scope; label: string }[] = [
  { value: "this", label: "Tylko to wydarzenie" },
  { value: "following", label: "To i następne" },
  { value: "all", label: "Wszystkie" },
];

type ScopeDialogProps = {
  open: boolean;
  /** Dla bloku niepowtarzanego dialog jest zwykłym potwierdzeniem (bez wyboru zakresu). Rodzic montuje dialog od nowa przy każdym użyciu, więc zakres startuje od „Tylko to wydarzenie”. */
  recurring: boolean;
  /** false: bez opcji „Tylko to wydarzenie” (np. przy zmianie powtarzania); zakres startuje wtedy od „To i następne”. */
  allowThis?: boolean;
  onPick: (scope: Scope) => void;
  /** Liczba wystąpień z zadaniami, które znikną przy wybranym zakresie (liczy rodzic przez previewEdit). */
  droppedTaskCount: number;
  onCancel: () => void;
  /** Wołane przy każdej zmianie zakresu (także z początkowym), żeby rodzic odświeżył `droppedTaskCount`. */
  onScopeChange?: (scope: Scope) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /** Opisy pod opcjami, np. „Czwartek, 19 listopada” i „Od 19 listopada”. */
  scopeHints?: Partial<Record<Scope, string>>;
  destructive?: boolean;
};

export function ScopeDialog({
  open,
  recurring,
  allowThis = true,
  onPick,
  droppedTaskCount,
  onCancel,
  onScopeChange,
  title = "Przesunąć powtarzany blok?",
  description = "Które wystąpienia zmienić?",
  confirmLabel = "Przesuń",
  scopeHints = {},
  destructive = false,
}: ScopeDialogProps) {
  const [scope, setScope] = useState<Scope>(allowThis ? "this" : "following");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 px-6 pb-2">
          {recurring && (
            <RadioGroup
              aria-label="Zakres zmiany"
              value={scope}
              onValueChange={(value) => {
                setScope(value as Scope);
                onScopeChange?.(value as Scope);
              }}
              className="gap-2"
            >
              {SCOPES.filter((option) => allowThis || option.value !== "this").map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-data-checked:border-foreground has-data-checked:bg-background"
                >
                  <Radio value={option.value} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{option.label}</span>
                    {scopeHints[option.value] && (
                      <span className="text-[13px] text-muted-foreground">{scopeHints[option.value]}</span>
                    )}
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {droppedTaskCount > 0 && (
            <div
              role="status"
              className="flex gap-2.5 rounded-xl bg-[#FFF1EA] p-3 text-[13px] leading-snug text-[#7C350E]"
            >
              <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Zadania w {droppedTaskCount} wystąpieniach, które znikną, zostaną usunięte</span>
            </div>
          )}
        </div>

        <AlertDialogFooter variant="bare">
          <AlertDialogClose render={<Button variant="outline" />}>Anuluj</AlertDialogClose>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => onPick(recurring ? scope : "all")}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
