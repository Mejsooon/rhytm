"use client";

import { useMemo, useRef, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { createCategory, updateCategory } from "@/app/(app)/kalendarz/category-actions";
import { NavSlot } from "@/components/nav/NavSlot";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import type { CalendarOccurrence } from "@/lib/calendar/calendar-events";
import type { CategoryColorId } from "@/lib/calendar/colors";
import { categoryCounts, type CalendarFilter } from "@/lib/calendar/filters";
import { miniHighlight } from "@/lib/calendar/mini-calendar";
import type { Category } from "@/lib/categories/categories";
import { CategoryDialog } from "./CategoryDialog";
import { CategoryList } from "./CategoryList";
import { MainCalendar, type CalendarNavigation, type MainCalendarHandle } from "./MainCalendar";
import { MiniCalendar } from "./MiniCalendar";

type CalendarWorkspaceProps = {
  /** Strefa czasowa z profilu (IANA). */
  timezone: string;
  /** Kategorie wczytane na serwerze; dalej żyją w stanie klienta. */
  initialCategories: Category[];
};

type DialogState = { mode: "create" } | { mode: "edit"; category: Category } | null;

/**
 * Strona kalendarza: trzyma kategorie, filtr (zakładka + ukryte kategorie) i ostatnio wczytane
 * wystąpienia. Mini kalendarz i lista kategorii trafiają do paska bocznego przez NavSlot.
 */
export function CalendarWorkspace({ timezone, initialCategories }: CalendarWorkspaceProps) {
  const calendarRef = useRef<MainCalendarHandle>(null);
  const [categories, setCategories] = useState(initialCategories);
  const [tab, setTab] = useState<"all" | string>("all");
  const [occurrences, setOccurrences] = useState<CalendarOccurrence[]>([]);
  const [navigation, setNavigation] = useState<CalendarNavigation | null>(null);
  const [miniMonth, setMiniMonth] = useState(() => formatInTimeZone(new Date(), timezone, "yyyy-MM"));
  const [dialog, setDialog] = useState<DialogState>(null);

  // Ukrycie kategorii to po prostu `visible === false` w jej wierszu.
  const filter = useMemo<CalendarFilter>(
    () => ({ tab, hidden: new Set(categories.filter((c) => !c.visible).map((c) => c.id)) }),
    [tab, categories],
  );
  // Liczniki z wystąpień całego widocznego zakresu, przed filtrowaniem (ukryta kategoria zachowuje licznik).
  const counts = useMemo(() => categoryCounts(occurrences), [occurrences]);
  const today = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");

  // Zmiana widoczności od razu w stanie; przy błędzie zapisu cofamy ją i pokazujemy toast.
  async function setVisible(id: string, visible: boolean) {
    setCategories((list) => list.map((c) => (c.id === id ? { ...c, visible } : c)));
    try {
      await updateCategory(id, { visible });
    } catch (error) {
      setCategories((list) => list.map((c) => (c.id === id ? { ...c, visible: !visible } : c)));
      toastManager.add({
        type: "error",
        title: "Nie udało się zmienić widoczności kategorii",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  function toggleCategory(id: string) {
    const category = categories.find((c) => c.id === id);
    if (category) void setVisible(id, !category.visible);
  }

  // Zapis z okna kategorii. Błąd leci dalej: okno pokazuje go pod polem nazwy i zostaje otwarte.
  async function submitCategory(input: { name: string; color: CategoryColorId }) {
    if (!dialog) return;
    if (dialog.mode === "create") {
      const created = await createCategory(input);
      setCategories((list) => [...list, created]);
    } else {
      const updated = await updateCategory(dialog.category.id, input);
      setCategories((list) => list.map((c) => (c.id === updated.id ? updated : c)));
    }
    setDialog(null);
  }

  // Kalendarz przeszedł do innego zakresu: mini kalendarz pokazuje jego miesiąc.
  function handleNavigate(next: CalendarNavigation) {
    setNavigation(next);
    setMiniMonth(next.currentStart.slice(0, 7));
  }

  return (
    <ToastProvider>
      <NavSlot>
        <MiniCalendar
          month={miniMonth}
          today={today}
          highlight={navigation ? miniHighlight(navigation.viewType, navigation.currentStart) : null}
          onPickDate={(date) => calendarRef.current?.gotoDate(date)}
          onMonthChange={setMiniMonth}
        />
        <CategoryList
          categories={categories}
          counts={counts}
          onToggle={toggleCategory}
          onAdd={() => setDialog({ mode: "create" })}
          onEdit={(category) => setDialog({ mode: "edit", category })}
        />
      </NavSlot>

      <MainCalendar
        ref={calendarRef}
        timezone={timezone}
        categories={categories}
        filter={filter}
        onTabChange={setTab}
        onShowCategory={(id) => void setVisible(id, true)}
        onOccurrencesLoaded={setOccurrences}
        onNavigate={handleNavigate}
      />

      {dialog && (
        <CategoryDialog
          open
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? dialog.category : undefined}
          categories={categories}
          onSubmit={submitCategory}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        />
      )}
    </ToastProvider>
  );
}
