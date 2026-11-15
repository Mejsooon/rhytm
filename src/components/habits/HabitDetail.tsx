"use client";

import { useState } from "react";
import { ArchiveIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import {
  QUIET_BUTTON_DANGER,
  QUIET_BUTTON_DESTRUCTIVE,
  QUIET_BUTTON_LIGHT,
  QUIET_CARD,
} from "@/components/calendar/quiet-classes";
import { useIsMobile } from "@/hooks/use-media-query";
import { heatmapDays } from "@/lib/habits/heatmap";
import { habitStreak, scheduleLabel, scheduleOn } from "@/lib/habits/schedule";
import type { HabitHistory } from "@/lib/habits/types";
import { habitDayKind, streakLabel } from "@/lib/habits/view";
import { cn } from "@/lib/utils";

const KIND_COLORS = { done: "#3E9B63", missed: "#E6E6E4", off: "#F4F4F3", future: "transparent" } as const;
const KIND_TITLES = { done: "odhaczony", missed: "zaplanowany, niezrobiony", off: "niezaplanowany", future: "" } as const;
const WEEKDAY_LABELS = ["Pn", "", "Śr", "", "Pt", "", ""];

type HabitDetailProps = {
  habit: HabitHistory;
  /** Dzisiejsza data w strefie profilu (YYYY-MM-DD). */
  today: string;
  /** „Edytuj”: rodzic zamyka szufladę i otwiera HabitDialog. */
  onEdit: () => void;
  /** Archiwizacja po potwierdzeniu; błąd obsługuje rodzic (toast). */
  onArchive: () => void;
  onClose: () => void;
};

/**
 * Szczegóły nawyku: szuflada z prawej (na mobile od dołu) z harmonogramem, serią i roczną heatmapą
 * tego nawyku (53 tygodnie kończące się bieżącym), plus „Edytuj” i „Archiwizuj” z potwierdzeniem.
 */
export function HabitDetail({ habit, today, onEdit, onArchive, onClose }: HabitDetailProps) {
  const isMobile = useIsMobile();
  const [confirming, setConfirming] = useState(false);
  const archived = habit.archivedOn !== null && habit.archivedOn <= today;
  const schedule = scheduleOn(habit, today) ?? habit.schedules[habit.schedules.length - 1];
  const streak = archived ? null : habitStreak(habit, today);
  const { weeks, monthLabels } = heatmapDays("year", today);
  const doneInYear = weeks.flat().filter((date) => date <= today && habit.checks.has(date)).length;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetPopup
        side={isMobile ? "bottom" : "right"}
        className={cn("text-[#191816]", !isMobile && "max-w-[520px]")}
        closeProps={{ "aria-label": "Zamknij" }}
      >
        <div className="flex flex-col gap-1.5 p-5 pe-14">
          <SheetTitle className="font-sans text-[17px] leading-snug font-semibold break-words text-[#191816]">
            {habit.name}
          </SheetTitle>
          <p className="text-[13px] text-[#7D7C78]">
            {scheduleLabel(schedule)}
            {archived &&
              ` · zarchiwizowany ${new Date(`${habit.archivedOn}T12:00:00Z`).toLocaleDateString("pl-PL", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}`}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5">
          <dl className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 rounded-[10px] border border-[#EAEAE8] px-3 py-2.5">
              <dt className="text-xs text-[#7D7C78]">Seria</dt>
              <dd className="text-[15px] font-medium">
                {streak === null ? "—" : streak.value === 0 ? "brak serii" : streakLabel(streak)}
              </dd>
            </div>
            <div className="flex flex-col gap-1 rounded-[10px] border border-[#EAEAE8] px-3 py-2.5">
              <dt className="text-xs text-[#7D7C78]">Odhaczeń w roku</dt>
              <dd className="text-[15px] font-medium tabular-nums">{doneInYear}</dd>
            </div>
          </dl>

          <section aria-label="Ostatni rok" className="flex flex-col gap-2">
            <h3 className="text-[13px] font-medium text-[#37352F]">Ostatni rok</h3>
            {/* Jedna siatka: wiersz 1 = miesiące, kolumna 1 = dni tygodnia, reszta = 53 tygodnie × 7 dni. */}
            <div
              role="img"
              aria-label={`Heatmapa nawyku z ostatniego roku: ${doneInYear} odhaczonych dni`}
              className="grid grid-cols-[auto_repeat(53,minmax(0,1fr))] gap-[2px] text-[9px] leading-none text-[#9B9A97]"
            >
              {monthLabels.map((month, index) => {
                // Etykieta zajmuje kolumny do następnej; zbyt wąska (pierwsza, ucięta) jest pomijana.
                const span = (monthLabels[index + 1]?.col ?? weeks.length) - month.col;
                if (span < 2) return null;
                return (
                  <span
                    key={month.col}
                    aria-hidden="true"
                    className="overflow-hidden pb-0.5 whitespace-nowrap"
                    style={{ gridRow: 1, gridColumn: `${month.col + 2} / span ${span}` }}
                  >
                    {month.label}
                  </span>
                );
              })}
              {WEEKDAY_LABELS.map((label, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className="flex items-center pe-1"
                  style={{ gridRow: index + 2, gridColumn: 1 }}
                >
                  {label}
                </span>
              ))}
              {weeks.map((week, col) =>
                week.map((date, row) => {
                  const kind = habitDayKind(habit, date, today);
                  return (
                    <span
                      key={date}
                      title={kind === "future" ? undefined : `${date} · ${KIND_TITLES[kind]}`}
                      className={cn("aspect-square rounded-[2px]", date === today && "outline outline-1 outline-[#191816]")}
                      style={{ gridRow: row + 2, gridColumn: col + 2, background: KIND_COLORS[kind] }}
                    />
                  );
                }),
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9B9A97]">
              {(["done", "missed", "off"] as const).map((kind) => (
                <span key={kind} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: KIND_COLORS[kind] }} />
                  {KIND_TITLES[kind]}
                </span>
              ))}
            </div>
          </section>
        </div>

        {!archived && (
          <div className="flex gap-2 border-t border-[#F0F0EE] p-4">
            <Button className={cn(QUIET_BUTTON_LIGHT, "max-md:h-10 max-md:flex-1")} onClick={onEdit}>
              Edytuj
            </Button>
            <Button className={cn(QUIET_BUTTON_DANGER, "max-md:h-10")} onClick={() => setConfirming(true)}>
              <ArchiveIcon aria-hidden="true" />
              Archiwizuj
            </Button>
          </div>
        )}

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogPopup className={cn("max-w-[400px]", QUIET_CARD)}>
            <div className="flex flex-col gap-3.5 p-5">
              <div className="flex flex-col gap-1">
                <AlertDialogTitle className="font-sans text-base leading-6 font-semibold text-[#191816]">
                  Zarchiwizować „{habit.name}”?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-[13px] leading-normal text-[#7D7C78]">
                  Nawyk zniknie z listy. Historia zostanie.
                </AlertDialogDescription>
              </div>
              <div className="flex justify-end gap-2">
                <AlertDialogClose render={<Button className={QUIET_BUTTON_LIGHT} />}>Anuluj</AlertDialogClose>
                <Button
                  className={QUIET_BUTTON_DESTRUCTIVE}
                  onClick={() => {
                    setConfirming(false);
                    onArchive();
                  }}
                >
                  Archiwizuj
                </Button>
              </div>
            </div>
          </AlertDialogPopup>
        </AlertDialog>
      </SheetPopup>
    </Sheet>
  );
}
