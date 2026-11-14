"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import FullCalendar, { type CalendarRef } from "@fullcalendar/react";
import type { DateSelectInfo, EventClickInfo, EventDropInfo, EventResizeDoneInfo } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import plLocale from "@fullcalendar/react/locales/pl";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon, RepeatIcon } from "lucide-react";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import "./calendar.css";
import { createBlock, deleteBlock, editBlock, previewEdit } from "@/app/(app)/kalendarz/actions";
import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";
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
import { CATEGORY_COLORS, type CategoryColorId } from "@/lib/calendar/colors";
import { filterOccurrences, revealAfterCreate, type CalendarFilter } from "@/lib/calendar/filters";
import { periodTitle } from "@/lib/calendar/mini-calendar";
import type { Category } from "@/lib/categories/categories";
import { cn } from "@/lib/utils";
import type { BlockChange, Scope } from "@/lib/calendar/plan-edit";
import { BlockForm } from "./BlockForm";
import { BlockPanel } from "./BlockPanel";
import { ScopeDialog } from "./ScopeDialog";

const VIEWS = [
  { type: "timeGridDay", label: "Dzień" },
  { type: "timeGridWeek", label: "Tydzień" },
  { type: "dayGridMonth", label: "Miesiąc" },
] as const;

type ViewType = (typeof VIEWS)[number]["type"];

// Przełącznik widoku i zakładki kategorii: wspólny wygląd segmentów (tło #F4F4F3, aktywny biały z cieniem).
const SEGMENT_GROUP = "flex w-max shrink-0 gap-0.5 rounded-lg bg-[#F4F4F3] p-0.5";
const SEGMENT = {
  base: "h-7 rounded-md border px-2.5 text-[13px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
  active: "border-[#E6E6E4] bg-white text-[#191816] shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
  idle: "border-transparent bg-transparent text-[#7D7C78] hover:text-[#191816]",
};
const NAV_BUTTON =
  "flex items-center justify-center bg-white text-[#5F5E5B] outline-none hover:bg-[#F7F7F6] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

// Reguły .rh-ev-<id> z jedynej palety (colors.ts), żeby CSS nie powtarzał wartości kolorów.
const CATEGORY_CSS = CATEGORY_COLORS.map(
  (c) => `.rh-ev-${c.id}{--rh-bg:${c.bg};--rh-border:${c.border};--rh-dot:${c.dot};--rh-ink:${c.ink};--rh-mid:${c.mid}}`,
).join("");

type FormState = { mode: "create"; initial: BlockFormValue } | { mode: "edit"; initial: BlockFormValue; occurrence: CalendarOccurrence };

// Oczekująca zmiana powtarzanego bloku, która czeka na wybór zakresu w ScopeDialog.
type PendingScope =
  | { kind: "edit"; occurrence: CalendarOccurrence; change: BlockChange; title: string; description: string; revert?: () => void }
  | { kind: "delete"; occurrence: CalendarOccurrence };

/** Aktualny widok kalendarza; `currentStart` to 'YYYY-MM-DD' w strefie profilu. */
export type CalendarNavigation = { viewType: ViewType; currentStart: string };

export type MainCalendarHandle = {
  /** Przejście do dnia 'YYYY-MM-DD' bez zmiany widoku. */
  gotoDate: (date: string) => void;
};

type MainCalendarProps = {
  ref?: Ref<MainCalendarHandle>;
  /** Strefa czasowa z profilu (IANA), np. Europe/Warsaw. */
  timezone: string;
  /** Kategorie użytkownika: kolory bloków, zakładki i domyślna kategoria nowego bloku. */
  categories: Category[];
  /** Zakładka i ukryte kategorie; bloki są filtrowane po stronie klienta. */
  filter: CalendarFilter;
  onTabChange: (tab: "all" | string) => void;
  /** Odkrycie kategorii (np. po utworzeniu w niej bloku). */
  onShowCategory: (categoryId: string) => void;
  /** Wszystkie wystąpienia wczytanego zakresu, przed filtrowaniem (liczniki kategorii). */
  onOccurrencesLoaded: (list: CalendarOccurrence[]) => void;
  onNavigate: (navigation: CalendarNavigation) => void;
  /** Kliknięcie bloku. Bez tej właściwości otwiera się panel bloku z zadaniami (BlockPanel). */
  onEventClick?: (occurrence: CalendarOccurrence) => void;
};

/**
 * Główny kalendarz. Strefa czasowa: FullCalendar v7 obsługuje nazwane strefy IANA natywnie
 * (przez temporal-polyfill), więc `timeZone={timezone}` wystarcza. Zdarzenia dostają chwile (ISO z „Z”),
 * a `event.start`/`event.end` zwracają prawdziwe chwile, które zamieniamy na lokalny czas strefy
 * profilu (`toLocalString`). Wtyczki motywu, daygrid, timegrid i interaction pochodzą z podścieżek
 * pakietu @fullcalendar/react (osobne pakiety @fullcalendar/* to v6 i nie wolno ich mieszać).
 */
export function MainCalendar({
  ref,
  timezone,
  categories,
  filter,
  onTabChange,
  onShowCategory,
  onOccurrencesLoaded,
  onNavigate,
  onEventClick,
}: MainCalendarProps) {
  const calendarRef = useRef<CalendarRef>(null);
  const isMobile = useIsMobile();
  const [title, setTitle] = useState("");
  const [viewType, setViewType] = useState<ViewType>("timeGridWeek");
  const [form, setForm] = useState<FormState | null>(null);
  const [pending, setPending] = useState<PendingScope | null>(null);
  const [panel, setPanel] = useState<CalendarOccurrence | null>(null);
  const [droppedTaskCount, setDroppedTaskCount] = useState(0);
  const previewCounter = useRef(0);
  // Ostatnia odpowiedź serwera dla zakresu (klucz „from|to”) i numer ostatniego wywołania `loadEvents`.
  // Licznik, a nie klucz zakresu: dwa wczytania tego samego zakresu (np. zapis, a zaraz potem usunięcie)
  // mają ten sam klucz, a liczy się tylko odpowiedź na ostatnie.
  const loadedRef = useRef<{ key: string; list: CalendarOccurrence[] } | null>(null);
  const requestSeqRef = useRef(0);
  // Bieżące propsy dla `loadEvents`, którą FullCalendar trzyma jako stałą funkcję.
  const latestRef = useRef({ categories, filter, onOccurrencesLoaded });
  // FullCalendar zaczyna wczytywać już w renderze, więc odpowiedź może przyjść przed zamontowaniem.
  // Wtedy liczniki przekazuje dopiero efekt montowania (setState rodzica przed montażem React odrzuca).
  const mountedRef = useRef(false);

  useImperativeHandle(ref, () => ({ gotoDate: (date) => calendarRef.current?.getApi().gotoDate(date) }), []);

  // Zmiana danych (zapis, usunięcie): odrzucamy zapamiętaną odpowiedź, więc FullCalendar pyta serwer.
  const refetch = () => {
    loadedRef.current = null;
    calendarRef.current?.getApi().refetchEvents();
  };

  // Zmiana filtra albo kategorii (np. koloru): ten sam zakres przerysowuje się z pamięci, bez zapytania.
  // Przed pierwszym wczytaniem nie ma czego przerysować (wczytanie w toku i tak użyje bieżących propsów).
  useEffect(() => {
    mountedRef.current = true;
    if (loadedRef.current) latestRef.current.onOccurrencesLoaded(loadedRef.current.list);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestRef.current = { categories, filter, onOccurrencesLoaded };
    if (loadedRef.current) calendarRef.current?.getApi().refetchEvents();
  }, [categories, filter, onOccurrencesLoaded]);

  // Domyślny widok: tydzień od md w górę, dzień poniżej (także po zmianie rozmiaru okna).
  useEffect(() => {
    calendarRef.current?.getApi().changeView(isMobile ? "timeGridDay" : "timeGridWeek");
  }, [isMobile]);

  // Źródło zdarzeń: widoczny zakres dat -> GET /api/occurrences. FullCalendar woła tę funkcję w trakcie
  // renderowania, dlatego to zwykły fetch, a nie Server Action (akcja aktualizowałaby Router Next.js
  // w środku renderu). JSON nie przenosi dat, więc start/end zamieniamy z powrotem na Date.
  // Błąd pokazujemy w toaście i zwracamy pustą listę.
  // Odpowiedź dla zakresu zostaje w `loadedRef`, a filtr i kolory kategorii nakładamy przy każdym wywołaniu.
  // Odpowiedź wyprzedzona przez nowsze wywołanie (inny zakres albo ponowne wczytanie tego samego)
  // nie nadpisuje pamięci ani liczników.
  const loadEvents = useCallback(async (info: { startStr: string; endStr: string }) => {
    const { from, to } = visibleDateRange(info.startStr, info.endStr);
    const key = `${from}|${to}`;
    const requestId = ++requestSeqRef.current;
    let list = loadedRef.current?.key === key ? loadedRef.current.list : null;
    if (!list) {
      try {
        const res = await fetch(`/api/occurrences?from=${from}&to=${to}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Nie udało się wczytać kalendarza");
        list = (body as CalendarOccurrence[]).map((o) => ({ ...o, start: new Date(o.start), end: new Date(o.end) }));
      } catch (error) {
        if (requestSeqRef.current !== requestId) return [];
        toastManager.add({
          type: "error",
          title: "Nie udało się wczytać kalendarza",
          description: error instanceof Error ? error.message : undefined,
        });
        return [];
      }
      if (requestSeqRef.current !== requestId) return [];
      loadedRef.current = { key, list };
    }
    const { categories: currentCategories, filter: currentFilter, onOccurrencesLoaded: onLoaded } = latestRef.current;
    if (mountedRef.current) onLoaded(list);
    const colors = new Map(currentCategories.map((c) => [c.id, c.color]));
    const colorOf = (categoryId: string): CategoryColorId => colors.get(categoryId) ?? "gray";
    return filterOccurrences(list, currentFilter).map((o) => occurrenceToEvent(o, colorOf));
  }, []);

  // Domyślna kategoria nowego bloku: kategoria wybranej zakładki, inaczej pierwsza widoczna, inaczej pierwsza.
  const defaultCategoryId =
    filter.tab !== "all"
      ? filter.tab
      : (categories.find((c) => c.visible) ?? categories[0])?.id ?? "";

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
    // Godziny w opisie w strefie profilu (change.start to chwila ISO).
    const oldStart = toLocalString(occurrence.start, timezone);
    const newStart = change.start !== undefined ? toLocalString(new Date(change.start), timezone) : oldStart;
    const timeOnly = oldStart.slice(0, 10) === newStart.slice(0, 10) && oldStart !== newStart;
    const next: PendingScope = {
      kind: "edit",
      occurrence,
      change,
      title: options.title,
      description: timeOnly
        ? `„${occurrence.title}” z ${oldStart.slice(11)} na ${newStart.slice(11)}. Które wystąpienia zmienić?`
        : `„${occurrence.title}”. Które wystąpienia zmienić?`,
      revert: options.revert,
    };
    setDroppedTaskCount(0);
    setPending(next);
    // Zmiana powtarzania nie ma opcji „tylko to”: dialog startuje od „to i następne”, więc od razu liczymy ostrzeżenie.
    if (change.recurrence !== undefined) void previewDropped(next, "following");
  }

  // Przeciągnięcie albo zmiana długości bloku w kalendarzu. Wysyłamy chwilę startu (ISO) i długość;
  // serwer przelicza chwilę na czas lokalny strefy bloku.
  function handleEventChange(info: EventDropInfo | EventResizeDoneInfo) {
    const occurrence: CalendarOccurrence = info.event.extendedProps.occurrence;
    const start = info.event.start;
    if (!start) return info.revert();
    const end = info.event.end ?? new Date(start.getTime() + (occurrence.end.getTime() - occurrence.start.getTime()));
    requestEdit(
      occurrence,
      { start: start.toISOString(), durationMin: Math.round((end.getTime() - start.getTime()) / 60_000) },
      { title: "Przesunąć powtarzany blok?", revert: info.revert },
    );
  }

  // Zaznaczenie zakresu: formularz nowego bloku. W widoku miesiąca (cały dzień) startujemy o 09:00 na godzinę.
  function handleSelect(info: DateSelectInfo) {
    calendarRef.current?.getApi().unselect();
    if (info.allDay) {
      setForm({ mode: "create", initial: emptyBlockForm(`${info.startStr.slice(0, 10)}T09:00`, 60, defaultCategoryId) });
      return;
    }
    const startLocal = toLocalString(info.start, timezone);
    const durationMin = Math.round((info.end.getTime() - info.start.getTime()) / 60_000);
    setForm({ mode: "create", initial: emptyBlockForm(startLocal, durationMin, defaultCategoryId) });
  }

  function handleEventClick(info: EventClickInfo) {
    const occurrence: CalendarOccurrence = info.event.extendedProps.occurrence;
    if (onEventClick) return onEventClick(occurrence);
    setPanel(occurrence);
  }

  // Przycisk „+”: blok na najbliższą pełną godzinę, na godzinę.
  function openNewBlock() {
    setForm({ mode: "create", initial: emptyBlockForm(nextFullHour(new Date(), timezone), 60, defaultCategoryId) });
  }

  async function submitForm(value: BlockFormValue) {
    if (!form) return;
    if (form.mode === "create") {
      await createBlock(formToNewBlock(value));
      setForm(null);
      // Nowy blok ma być widoczny: zakładka innej kategorii wraca na „Wszystkie”, ukryta kategoria się odkrywa.
      const reveal = revealAfterCreate(filter, value.categoryId);
      if (reveal.tab !== filter.tab) onTabChange(reveal.tab);
      if (reveal.unhide) onShowCategory(value.categoryId);
      refetch();
      return;
    }
    // Tylko zmienione pola (np. sama zmiana nazwy nie przesuwa serii); brak zmian = po prostu zamknięcie.
    const change = formToChange(value, form.initial, timezone);
    const { occurrence } = form;
    setForm(null);
    if (Object.keys(change).length === 0) return;
    requestEdit(occurrence, change, { title: "Zmienić powtarzany blok?" });
  }

  // Ostrzeżenie o zadaniach, które znikną: previewEdit (bez zapisu). Licznik odrzuca spóźnione odpowiedzi.
  async function previewDropped(target: PendingScope, scope: Scope) {
    const callId = ++previewCounter.current;
    // `this` nigdy nie usuwa zadań.
    if (target.kind !== "edit" || scope === "this") {
      setDroppedTaskCount(0);
      return;
    }
    try {
      const { droppedTaskDates } = await previewEdit(
        target.occurrence.blockId,
        target.occurrence.occurrenceDate,
        scope,
        target.change,
      );
      if (callId === previewCounter.current) setDroppedTaskCount(droppedTaskDates.length);
    } catch {
      if (callId === previewCounter.current) setDroppedTaskCount(0);
    }
  }

  function handleScopeChange(scope: Scope) {
    if (pending) void previewDropped(pending, scope);
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

  const navLabel = viewType === "timeGridDay" ? "dzień" : viewType === "timeGridWeek" ? "tydzień" : "miesiąc";

  return (
    <>
      <style>{CATEGORY_CSS}</style>
      <div className="flex h-full min-h-0 flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-3 bg-white px-4 pt-4 pb-3 md:px-7 md:pt-5">
          <nav aria-label="Ścieżka" className="flex items-center gap-2 text-[13px] text-[#9B9A97]">
            <span>Rhytm</span>
            <span aria-hidden="true">›</span>
            <span aria-current="page" className="rounded-[5px] bg-[#F4F4F3] px-1.5 py-0.5 font-medium text-[#37352F]">
              Kalendarz
            </span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-[#191816]">{title}</h1>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <div className="flex h-[34px] overflow-hidden rounded-lg border border-[#E6E6E4]">
                <button
                  type="button"
                  aria-label={`Poprzedni ${navLabel}`}
                  className={cn(NAV_BUTTON, "w-9")}
                  onClick={() => calendarRef.current?.getApi().prev()}
                >
                  <ArrowLeftIcon aria-hidden="true" className="size-[15px]" />
                </button>
                <button
                  type="button"
                  className={cn(NAV_BUTTON, "border-x border-[#E6E6E4] px-3.5 text-[13px] font-medium text-[#37352F]")}
                  onClick={() => calendarRef.current?.getApi().today()}
                >
                  Dzisiaj
                </button>
                <button
                  type="button"
                  aria-label={`Następny ${navLabel}`}
                  className={cn(NAV_BUTTON, "w-9")}
                  onClick={() => calendarRef.current?.getApi().next()}
                >
                  <ArrowRightIcon aria-hidden="true" className="size-[15px]" />
                </button>
              </div>
              <div role="group" aria-label="Widok kalendarza" className={SEGMENT_GROUP}>
                {VIEWS.map((view) => (
                  <button
                    key={view.type}
                    type="button"
                    aria-pressed={viewType === view.type}
                    className={cn(SEGMENT.base, viewType === view.type ? SEGMENT.active : SEGMENT.idle)}
                    onClick={() => calendarRef.current?.getApi().changeView(view.type)}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="flex h-[34px] items-center gap-1.5 rounded-lg bg-[#191816] px-3 text-[13px] font-medium text-white outline-none hover:bg-[#37352F] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-md:hidden"
                onClick={openNewBlock}
              >
                <PlusIcon aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
                Dodaj blok
              </button>
            </div>
          </div>
          {/* Zakładki-filtry: „Wszystkie” i po jednej na kategorię. Na wąskim ekranie przewijają się w bok. */}
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <div role="group" aria-label="Filtr kategorii" className={SEGMENT_GROUP}>
              {[{ id: "all", name: "Wszystkie" }, ...categories].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={filter.tab === tab.id}
                  className={cn(SEGMENT.base, filter.tab === tab.id ? SEGMENT.active : SEGMENT.idle)}
                  onClick={() => onTabChange(tab.id)}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 px-4 pb-4 md:px-7 md:pb-7">
          <div className="rh-calendar h-full overflow-hidden rounded-xl border border-[#EAEAE8]">
            <FullCalendar
              ref={calendarRef}
              plugins={[classicThemePlugin, dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locale={plLocale}
              firstDay={1}
              timeZone={timezone}
              initialView="timeGridWeek"
              headerToolbar={false}
              borderless
              height="100%"
              allDaySlot={false}
              slotMinTime="00:00:00"
              slotMaxTime="24:00:00"
              slotDuration="00:30:00"
              slotMinHeight={24}
              snapDuration="00:15:00"
              scrollTime="07:00:00"
              nowIndicator
              selectable
              selectMirror
              editable
              eventStartEditable
              eventDurationEditable
              views={{
                // Miesiąc: najwyżej 2 „żetony” na dzień i „+N więcej”.
                dayGridMonth: { dayMaxEvents: 2 },
              }}
              moreLinkContent={(info) => `+${info.num} więcej`}
              moreLinkClass="rh-more"
              // Żeton ma własną kropkę w kolorze kategorii, więc kropkę motywu przy zdarzeniu-punkcie listy chowamy.
              listItemEventBeforeClass="rh-hidden"
              dayCellTopClass="rh-cell-top"
              dayHeaderFormat={{ weekday: "short", day: "numeric" }}
              slotHeaderFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              slotHeaderInnerClass={(info) => cn("rh-slot-label", info.isFirst && "rh-slot-first")}
              slotHeaderDividerClass="rh-axis-divider"
              slotLaneClass={(info) => (info.isMinor ? "rh-slot-minor" : undefined)}
              dayHeaderClass="rh-day-head"
              dayHeaderDividerClass="rh-head-divider"
              dayLaneClass={(info) => cn("rh-lane", (info.dow === 0 || info.dow === 6) && "rh-weekend")}
              dayCellClass={(info) =>
                cn("rh-cell", (info.dow === 0 || info.dow === 6 || info.isOther) && "rh-weekend", info.isOther && "rh-other")
              }
              nowIndicatorDotClass="rh-now-dot"
              nowIndicatorHeaderClass="rh-now-header"
              dayHeaderContent={(info) => {
                const weekday = info.weekdayText.replace(".", "");
                if (info.view.type === "dayGridMonth") {
                  return <span className="rh-day-header">{weekday.charAt(0).toUpperCase() + weekday.slice(1)}</span>;
                }
                return (
                  <span className="rh-day-header">
                    <span>{weekday}</span>
                    <span className="rh-day-number" data-today={info.isToday ? "" : undefined}>
                      {info.dayNumberText}
                    </span>
                  </span>
                );
              }}
              dayCellTopContent={(info) => (
                <span className="rh-cell-number" data-today={info.isToday ? "" : undefined}>
                  {info.dayNumberText}
                </span>
              )}
              events={loadEvents}
              datesSet={(info) => {
                const type = info.view.type as ViewType;
                const currentStart = formatInTimeZone(info.view.currentStart, timezone, "yyyy-MM-dd");
                setTitle(periodTitle(type, currentStart));
                setViewType(type);
                onNavigate({ viewType: type, currentStart });
              }}
              select={handleSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventChange}
              eventResize={handleEventChange}
              eventContent={(info) => {
                const occurrence: CalendarOccurrence | undefined = info.event.extendedProps.occurrence;
                const start = info.event.start;
                const end = info.event.end;
                // Miesiąc: żeton z kropką koloru, godziną startu i tytułem.
                if (info.view.type === "dayGridMonth") {
                  return (
                    <span className="rh-chip">
                      <span className="rh-chip-dot" aria-hidden="true" />
                      {start && <span className="rh-chip-time">{toLocalString(start, timezone).slice(11)}</span>}
                      <span className="rh-chip-title">{info.event.title}</span>
                    </span>
                  );
                }
                const range =
                  start && end
                    ? `${toLocalString(start, timezone).slice(11)} – ${toLocalString(end, timezone).slice(11)}`
                    : "";
                const hasTasks = (occurrence?.taskTotal ?? 0) > 0;
                return (
                  <div className="rh-ev-body">
                    <span className="rh-ev-title">
                      <span className="rh-ev-title-text">{info.event.title}</span>
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
        </div>

        {/* Pływający przycisk „+” na mobile (od md jest przycisk „Dodaj blok” w nagłówku). */}
        <Button
          size="icon-xl"
          aria-label="Nowy blok"
          className="fixed right-4 bottom-24 z-20 rounded-full shadow-lg md:hidden"
          onClick={openNewBlock}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>

      {/* Panel zamyka się przed edycją/usunięciem: dalej działają te same przepływy (BlockForm, ScopeDialog). */}
      {panel && (
        <BlockPanel
          key={`${panel.blockId}|${panel.occurrenceDate}`}
          occurrence={panel}
          timezone={timezone}
          onChanged={refetch}
          onClose={() => setPanel(null)}
          onEdit={() => {
            setForm({ mode: "edit", initial: blockFormFromOccurrence(panel, timezone), occurrence: panel });
            setPanel(null);
          }}
          onDelete={() => {
            setDroppedTaskCount(0);
            setPending({ kind: "delete", occurrence: panel });
            setPanel(null);
          }}
        />
      )}

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
          allowThis={!(pending.kind === "edit" && pending.change.recurrence !== undefined)}
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
    </>
  );
}
