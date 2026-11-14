"use client";

import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import type { Scope } from "@/lib/calendar/plan-edit";
import { cn } from "@/lib/utils";
import { QUIET_BUTTON_DARK, QUIET_BUTTON_DESTRUCTIVE, QUIET_BUTTON_LIGHT, QUIET_CARD } from "./quiet-classes";

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
      <AlertDialogPopup className={cn("max-w-[400px]", QUIET_CARD)}>
        <div className="flex flex-col gap-3.5 p-5">
          <div className="flex flex-col gap-1">
            <AlertDialogTitle className="font-sans text-base leading-6 font-semibold text-[#191816]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-normal text-[#7D7C78]">
              {description}
            </AlertDialogDescription>
          </div>

          {recurring && (
            <RadioGroup
              aria-label="Zakres zmiany"
              value={scope}
              onValueChange={(value) => {
                setScope(value as Scope);
                onScopeChange?.(value as Scope);
              }}
              className="gap-1.5"
            >
              {SCOPES.filter((option) => allowThis || option.value !== "this").map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#E6E6E4] px-3 py-2.5 has-data-checked:border-[#37352F]"
                >
                  <Radio value={option.value} className="mt-0.5" />
                  <span className="flex flex-col gap-px">
                    <span className="text-[13px] font-medium">{option.label}</span>
                    {scopeHints[option.value] && (
                      <span className="text-xs text-[#7D7C78]">{scopeHints[option.value]}</span>
                    )}
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}

          {droppedTaskCount > 0 && (
            <div
              role="status"
              className="flex gap-2 rounded-lg border border-[#F3E4C4] bg-[#FFF9EE] px-3 py-2.5 text-xs leading-[1.45] text-[#7A5414]"
            >
              <TriangleAlertIcon aria-hidden="true" className="mt-px size-[15px] shrink-0" />
              <span>Zadania w {droppedTaskCount} wystąpieniach, które znikną, zostaną usunięte</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <AlertDialogClose render={<Button className={QUIET_BUTTON_LIGHT} />}>Anuluj</AlertDialogClose>
            <Button
              className={destructive ? QUIET_BUTTON_DESTRUCTIVE : QUIET_BUTTON_DARK}
              onClick={() => onPick(recurring ? scope : "all")}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
