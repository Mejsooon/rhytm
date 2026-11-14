"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar, { type CalendarRef } from "@fullcalendar/react";
import type { DateSelectInfo, EventClickInfo, EventDropInfo, EventResizeDoneInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import plLocale from "@fullcalendar/react/locales/pl";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, RepeatIcon } from "lucide-react";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import "./calendar.css";
import { createBlock, deleteBlock, editBlock, listOccurrences, previewEdit } from "@/app/(app)/kalendarz/actions";
import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { ToastProvider, toastManager } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-media-query";
import {
  blockFormFromOccurrence,
  emptyBlockForm,
  formToChange,
  formToNewBlock,
  nextFullHour,
  toLocalString,
  type BlockFormValue,
} from "@/lib/calendar/block-form";
import { occurrenceToEvent, visibleDateRange, type CalendarOccurrence } from "@/lib/calendar/calendar-events";
import { CATEGORY_COLORS } from "@/lib/calendar/colors";
import type { BlockChange, Scope } from "@/lib/calendar/plan-edit";
import { BlockForm } from "./BlockForm";
import { ScopeDialog } from "./ScopeDialog";

const VIEWS = [
  { type: "timeGridDay", label: "Dzień" },
  { type: "timeGridWeek", label: "Tydzień" },
  { type: "dayGridMonth", label: "Miesiąc" },
] as const;

// Reguły .rh-ev-<id> z jedynej palety (colors.ts), żeby CSS nie powtarzał wartości kolorów.
const CATEGORY_CSS = CATEGORY_COLORS.map(
  (c) => `.rh-ev-${c.id}{--rh-bg:${c.bg};--rh-border:${c.border};--rh-bar:${c.bar};--rh-ink:${c.ink}}`,
).join("");

type FormState = { mode: "create"; initial: BlockFormValue } | { mode: "edit"; initial: BlockFormValue; occurrence: CalendarOccurrence };

// Oczekująca zmiana powtarzanego bloku, która czeka na wybór zakresu w ScopeDialog.
type PendingScope =
  | { kind: "edit"; occurrence: CalendarOccurrence; change: BlockChange; title: string; description: string; revert?: () => void }
  | { kind: "delete"; occurrence: CalendarOccurrence };

type MainCalendarProps = {
  /** Strefa czasowa z profilu (IANA), np. Europe/Warsaw. */
  timezone: string;
  /** Kliknięcie bloku. Bez tej właściwości otwiera się formularz edycji (Task 9 podłączy tu panel bloku). */
  onEventClick?: (occurrence: CalendarOccurrence) => void;
};

/**
 * Główny kalendarz. Strefa czasowa: FullCalendar v7 obsługuje nazwane strefy IANA natywnie
 * (przez temporal-polyfill), więc `timeZone={timezone}` wystarcza. Zdarzenia dostają chwile (ISO z „Z”),
 * a `event.start`/`event.end` zwracają prawdziwe chwile, które zamieniamy na lokalny czas strefy
 * profilu (`toLocalString`). Wtyczki motywu, daygrid, timegrid i interaction pochodzą z podścieżek
 * pakietu @fullcalendar/react (osobne pakiety @fullcalendar/* to v6 i nie wolno ich mieszać).
 */
export function MainCalendar({ timezone, onEventClick }: MainCalendarProps) {
  const calendarRef = useRef<CalendarRef>(null);
  const isMobile = useIsMobile();
  const [title, setTitle] = useState("");
  const [viewType, setViewType] = useState<string>("timeGridWeek");
  const [form, setForm] = useState<FormState | null>(null);
  const [pending, setPending] = useState<PendingScope | null>(null);
  const [droppedTaskCount, setDroppedTaskCount] = useState(0);
  const previewCounter = useRef(0);

  const refetch = () => calendarRef.current?.getApi().refetchEvents();

  // Domyślny widok: tydzień od md w górę, dzień poniżej (także po zmianie rozmiaru okna).
  useEffect(() => {
    calendarRef.current?.getApi().changeView(isMobile ? "timeGridDay" : "timeGridWeek");
  }, [isMobile]);

  // Źródło zdarzeń: widoczny zakres dat -> listOccurrences. Błąd pokazujemy w toaście i zwracamy pustą listę.
  const loadEvents = useCallback(async (info: { startStr: string; endStr: string }) => {
    const { from, to } = visibleDateRange(info.startStr, info.endStr);
    try {
      return (await listOccurrences(from, to)).map(occurrenceToEvent);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Nie udało się wczytać kalendarza",
        description: error instanceof Error ? error.message : undefined,
      });
      return [];
    }
  }, []);

  // Zapis zmiany bloku. Dla bloku niepowtarzanego od razu, dla powtarzanego po wyborze zakresu w ScopeDialog.
  async function saveEdit(occurrence: CalendarOccurrence, scope: Scope, change: BlockChange, revert?: () => void) {
    try {
      await editBlock(occurrence.blockId, occurrence.occurrenceDate, scope, change);
    } catch (error) {
      revert?.();
      toastManager.add({
        type: "error",
        title: "Nie udało się zapisać zmiany",
        description: error instanceof Error ? error.message : undefined,
      });
    }
    refetch();
  }

  function requestEdit(
    occurrence: CalendarOccurrence,
    change: BlockChange,
    options: { title: string; revert?: () => void },
  ) {
    if (!occurrence.recurring) {
      void saveEdit(occurrence, "all", change, options.revert);
      return;
    }
    const oldStart = toLocalString(occurrence.start, timezone);
    const newStart = change.startLocal ?? oldStart;
    const timeOnly = oldStart.slice(0, 10) === newStart.slice(0, 10) && oldStart !== newStart;
    setDroppedTaskCount(0);
    setPending({
      kind: "edit",
      occurrence,
      change,
      title: options.title,
      description: timeOnly
        ? `„${occurrence.title}” z ${oldStart.slice(11)} na ${newStart.slice(11)}. Które wystąpienia zmienić?`
        : `„${occurrence.title}”. Które wystąpienia zmienić?`,
      revert: options.revert,
    });
  }

  // Przeciągnięcie albo zmiana długości bloku w kalendarzu.
  function handleEventChange(info: EventDropInfo | EventResizeDoneInfo) {
    const occurrence: CalendarOccurrence = info.event.extendedProps.occurrence;
    const start = info.event.start;
    if (!start) return info.revert();
    const end = info.event.end ?? new Date(start.getTime() + (occurrence.end.getTime() - occurrence.start.getTime()));
    requestEdit(
      occurrence,
      { startLocal: toLocalString(start, timezone), durationMin: Math.round((end.getTime() - start.getTime()) / 60_000) },
      { title: "Przesunąć powtarzany blok?", revert: info.revert },
    );
  }

  // Zaznaczenie zakresu: formularz nowego bloku. W widoku miesiąca (cały dzień) startujemy o 09:00 na godzinę.
  function handleSelect(info: DateSelectInfo) {
    calendarRef.current?.getApi().unselect();
    if (info.allDay) {
      setForm({ mode: "create", initial: emptyBlockForm(`${info.startStr.slice(0, 10)}T09:00`, 60) });
      return;
    }
    const startLocal = toLocalString(info.start, timezone);
    const durationMin = Math.round((info.end.getTime() - info.start.getTime()) / 60_000);
    setForm({ mode: "create", initial: emptyBlockForm(startLocal, durationMin) });
  }

  function handleEventClick(info: EventClickInfo) {
    const occurrence: CalendarOccurrence = info.event.extendedProps.occurrence;
    if (onEventClick) return onEventClick(occurrence);
    setForm({ mode: "edit", initial: blockFormFromOccurrence(occurrence, timezone), occurrence });
  }

  // Przycisk „+”: blok na najbliższą pełną godzinę, na godzinę.
  function openNewBlock() {
    setForm({ mode: "create", initial: emptyBlockForm(nextFullHour(new Date(), timezone), 60) });
  }

  async function submitForm(value: BlockFormValue) {
    if (!form) return;
    if (form.mode === "create") {
      await createBlock(formToNewBlock(value));
      setForm(null);
      refetch();
      return;
    }
    const change = formToChange(value);
    const { occurrence } = form;
    setForm(null);
    requestEdit(occurrence, change, { title: "Zmienić powtarzany blok?" });
  }

  // Wybór zakresu: rodzic liczy ostrzeżenie przez previewEdit (bez zapisu), `this` nigdy nie usuwa zadań.
  async function handleScopeChange(scope: Scope) {
    if (pending?.kind !== "edit" || scope === "this") {
      setDroppedTaskCount(0);
      return;
    }
    const callId = ++previewCounter.current;
    try {
      const { droppedTaskDates } = await previewEdit(
        pending.occurrence.blockId,
        pending.occurrence.occurrenceDate,
        scope,
        pending.change,
      );
      if (callId === previewCounter.current) setDroppedTaskCount(droppedTaskDates.length);
    } catch {
      if (callId === previewCounter.current) setDroppedTaskCount(0);
    }
  }

  async function handleScopePick(scope: Scope) {
    if (!pending) return;
    const current = pending;
    setPending(null);
    if (current.kind === "edit") {
      await saveEdit(current.occurrence, scope, current.change, current.revert);
      return;
    }
    try {
      await deleteBlock(current.occurrence.blockId, current.occurrence.occurrenceDate, scope);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Nie udało się usunąć bloku",
        description: error instanceof Error ? error.message : undefined,
      });
    }
    refetch();
  }

  function handleScopeCancel() {
    if (pending?.kind === "edit") pending.revert?.();
    setPending(null);
  }

  // Podpowiedzi pod opcjami zakresu, np. „Czwartek, 19 listopada” i „Od 19 listopada”.
  let scopeHints: Partial<Record<Scope, string>> = {};
  if (pending) {
    const day = new Date(`${pending.occurrence.occurrenceDate}T12:00:00Z`);
    const long = day.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    const short = day.toLocaleDateString("pl-PL", { day: "numeric", month: "long", timeZone: "UTC" });
    scopeHints = {
      this: long.charAt(0).toUpperCase() + long.slice(1),
      following: `Od ${short}`,
      all: "Cała seria, także przeszłe",
    };
  }

  return (
    <ToastProvider>
      <style>{CATEGORY_CSS}</style>
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 md:px-6 md:py-4">
          <h1 className="font-heading text-xl font-bold tracking-tight md:text-[26px]">{title}</h1>
          <div className="flex items-center gap-1 md:ml-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Poprzedni okres"
              onClick={() => calendarRef.current?.getApi().prev()}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button variant="outline" onClick={() => calendarRef.current?.getApi().today()}>
              Dzisiaj
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Następny okres"
              onClick={() => calendarRef.current?.getApi().next()}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <SegmentedControl aria-label="Widok">
              {VIEWS.map((view) => (
                <SegmentedControlItem
                  key={view.type}
                  aria-pressed={viewType === view.type}
                  data-checked={viewType === view.type ? "" : undefined}
                  onClick={() => calendarRef.current?.getApi().changeView(view.type)}
                >
                  {view.label}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
            <Button className="max-md:hidden" onClick={openNewBlock}>
              <PlusIcon aria-hidden="true" />
              Nowy blok
            </Button>
          </div>
        </header>

        <div className="rh-calendar min-h-0 flex-1">
          <FullCalendar
            ref={calendarRef}
            plugins={[classicThemePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={plLocale}
            firstDay={1}
            timeZone={timezone}
            initialView="timeGridWeek"
            headerToolbar={false}
            height="100%"
            allDaySlot={false}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            scrollTime="07:00:00"
            nowIndicator
            selectable
            selectMirror
            editable
            eventStartEditable
            eventDurationEditable
            dayHeaderFormat={{ weekday: "short", day: "numeric" }}
            slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            slotHeaderInnerClass="rh-slot-label"
            dayLaneClass={(info) => (info.dow === 0 || info.dow === 6 ? "rh-weekend" : undefined)}
            dayCellClass={(info) => (info.dow === 0 || info.dow === 6 ? "rh-weekend" : undefined)}
            dayHeaderContent={(info) => (
              <span className="rh-day-header">
                <span>{info.weekdayText.replace(".", "")}</span>
                {info.view.type !== "dayGridMonth" && (
                  <span className="rh-day-number" data-today={info.isToday ? "" : undefined}>
                    {info.dayNumberText}
                  </span>
                )}
              </span>
            )}
            events={loadEvents}
            datesSet={(info) => {
              setTitle(info.view.title);
              setViewType(info.view.type);
            }}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventChange}
            eventResize={handleEventChange}
            eventContent={(info) => {
              const occurrence: CalendarOccurrence | undefined = info.event.extendedProps.occurrence;
              const start = info.event.start;
              const end = info.event.end;
              const range =
                start && end
                  ? `${toLocalString(start, timezone).slice(11)}–${toLocalString(end, timezone).slice(11)}`
                  : "";
              const hasTasks = (occurrence?.taskTotal ?? 0) > 0;
              return (
                <div className="rh-ev-body">
                  <span className="rh-ev-title">
                    {info.event.title}
                    {occurrence?.recurring && (
                      <RepeatIcon aria-label="Blok powtarzany" className="size-[11px] shrink-0 opacity-70" />
                    )}
                  </span>
                  {!info.isShort && <span className="rh-ev-time">{range}</span>}
                  {!info.isShort && hasTasks && occurrence && (
                    <span className="rh-ev-progress" aria-hidden="true">
                      <span style={{ width: `${(occurrence.taskDone / occurrence.taskTotal) * 100}%` }} />
                    </span>
                  )}
                </div>
              );
            }}
          />
        </div>

        {/* Pływający przycisk „+” na mobile (od md jest przycisk „Nowy blok” w nagłówku). */}
        <Button
          size="icon-xl"
          aria-label="Nowy blok"
          className="fixed right-4 bottom-24 z-20 rounded-full shadow-lg md:hidden"
          onClick={openNewBlock}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>

      {form && (
        <BlockForm
          open
          mode={form.mode}
          initialValue={form.initial}
          onSubmit={submitForm}
          onDelete={
            form.mode === "edit"
              ? () => {
                  const occurrence = form.occurrence;
                  setForm(null);
                  setDroppedTaskCount(0);
                  setPending({ kind: "delete", occurrence });
                }
              : undefined
          }
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
        />
      )}

      {pending && (
        <ScopeDialog
          open
          recurring={pending.occurrence.recurring}
          droppedTaskCount={droppedTaskCount}
          scopeHints={scopeHints}
          onScopeChange={handleScopeChange}
          onPick={handleScopePick}
          onCancel={handleScopeCancel}
          title={
            pending.kind === "edit"
              ? pending.title
              : pending.occurrence.recurring
                ? "Usunąć powtarzany blok?"
                : "Usunąć blok?"
          }
          description={
            pending.kind === "edit"
              ? pending.description
              : pending.occurrence.recurring
                ? `„${pending.occurrence.title}”. Które wystąpienia usunąć?`
                : `„${pending.occurrence.title}” zostanie usunięty razem z zadaniami.`
          }
          confirmLabel={pending.kind === "delete" ? "Usuń" : pending.title.startsWith("Przesunąć") ? "Przesuń" : "Zapisz"}
          destructive={pending.kind === "delete"}
        />
      )}
    </ToastProvider>
  );
}
