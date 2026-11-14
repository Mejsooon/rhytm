"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { RadioGroupPrimitive, RadioPrimitive } from "@/components/ui/radio-group";
import { CATEGORY_COLORS, categoryColor, type CategoryColorId } from "@/lib/calendar/colors";
import { colorUsage, validateCategoryInput, type Category } from "@/lib/categories/categories";
import { cn } from "@/lib/utils";

type CategoryDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  /** Tylko w trybie edycji: edytowana kategoria. */
  initial?: Category;
  /** Wszystkie kategorie użytkownika (do walidacji unikalności i wyblakłych kolorów). */
  categories: Category[];
  /** Zapis; rzucony błąd zostaje pokazany pod polem nazwy, a okno zostaje otwarte. Zamyka je rodzic. */
  onSubmit: (input: { name: string; color: CategoryColorId }) => Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function CategoryDialog({ open, mode, initial, categories, onSubmit, onOpenChange }: CategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-[440px]">
        {/* Formularz montuje się przy każdym otwarciu, więc stan zawsze startuje od wartości początkowych. */}
        <CategoryForm
          mode={mode}
          initial={initial}
          categories={categories}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogPopup>
    </Dialog>
  );
}

type CategoryFormProps = Pick<CategoryDialogProps, "mode" | "initial" | "categories" | "onSubmit"> & {
  onCancel: () => void;
};

function CategoryForm({ mode, initial, categories, onSubmit, onCancel }: CategoryFormProps) {
  const editingId = mode === "edit" ? initial?.id : undefined;
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<CategoryColorId>(() => {
    if (initial) return initial.color;
    // Nowa kategoria: pierwszy niezajęty kolor z palety, a gdy wszystkie zajęte, niebieski.
    return CATEGORY_COLORS.find((c) => colorUsage(categories, c.id) === null)?.id ?? "blue";
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = categoryColor(color);
  const selectedUsedBy = colorUsage(categories, color, editingId);
  const previewName = name.trim() || "Nowa kategoria";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = validateCategoryInput({ name, color }, categories, editingId);
      await onSubmit(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać kategorii");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Nowa kategoria" : "Edytuj kategorię"}</DialogTitle>
      </DialogHeader>

      <DialogPanel className="flex flex-col gap-[18px]">
        <Field>
          <FieldLabel>Nazwa</FieldLabel>
          <Input
            autoFocus
            value={name}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive-foreground">
              {error}
            </p>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-medium text-[#37352F]">Kolor</legend>
          <RadioGroupPrimitive
            aria-label="Kolor kategorii"
            value={color}
            onValueChange={(value) => {
              setColor(value as CategoryColorId);
              setError(null);
            }}
            className="flex flex-row flex-wrap gap-2"
          >
            {CATEGORY_COLORS.map((c) => {
              const usedBy = colorUsage(categories, c.id, editingId);
              const checked = c.id === color;
              return (
                <RadioPrimitive.Root
                  key={c.id}
                  value={c.id}
                  aria-label={c.label}
                  title={usedBy ? `${c.label} · używa „${usedBy}”` : c.label}
                  className={cn(
                    "flex size-8 cursor-pointer items-center justify-center rounded-full bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    checked ? "border-[1.5px] border-[#191816]" : "border border-[#E6E6E4]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-[18px] rounded-full"
                    style={{ background: c.dot, opacity: usedBy && !checked ? 0.35 : 1 }}
                  />
                </RadioPrimitive.Root>
              );
            })}
          </RadioGroupPrimitive>
          <span className="text-xs text-[#9B9A97]">
            {selectedUsedBy
              ? `Tego koloru używa już kategoria „${selectedUsedBy}”. Możesz go wybrać, ale bloki będą trudniejsze do odróżnienia.`
              : "Wyblakłe kolory mają już inne kategorie."}
          </span>
        </fieldset>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-[#37352F]">Podgląd</span>
          <div className="grid grid-cols-2 gap-2.5 rounded-[10px] border border-[#EAEAE8] bg-[#FBFBFA] p-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] text-[#9B9A97]">W menu bocznym</span>
              <div className="flex h-8 items-center gap-2.5 rounded-md border border-[#EDEDEC] bg-white px-2.5 text-sm text-[#5F5E5B]">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: selected.dot }} />
                <span className="min-w-0 flex-1 truncate">{previewName}</span>
                <span className="text-xs text-[#9B9A97]">0</span>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] text-[#9B9A97]">Blok w kalendarzu</span>
              <div
                className="box-border flex h-14 flex-col gap-px rounded-md border px-2 py-1.5"
                style={{ background: selected.bg, borderColor: selected.border }}
              >
                <span className="truncate text-xs font-medium" style={{ color: selected.ink }}>
                  {previewName}
                </span>
                <span className="text-[11px]" style={{ color: selected.mid }}>
                  16:00 – 18:00
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogPanel>

      <DialogFooter variant="bare">
        <Button type="button" variant="outline" onClick={onCancel}>
          Anuluj
        </Button>
        <Button type="submit" disabled={saving}>
          {mode === "create" ? "Dodaj kategorię" : "Zapisz"}
        </Button>
      </DialogFooter>
    </form>
  );
}
