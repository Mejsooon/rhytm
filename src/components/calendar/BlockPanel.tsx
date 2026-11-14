"use client";

import { useEffect, useState } from "react";
import { RepeatIcon, TrashIcon } from "lucide-react";
import { addTask, deleteTask, listTasks, renameTask, toggleTask, type BlockTask } from "@/app/(app)/kalendarz/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetPanel, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { toastManager } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-media-query";
import { occurrenceHeading, taskProgress } from "@/lib/calendar/block-panel";
import type { CalendarOccurrence } from "@/lib/calendar/calendar-events";
import { categoryColor } from "@/lib/calendar/colors";
import { cn } from "@/lib/utils";

type BlockPanelProps = {
  occurrence: CalendarOccurrence;
  /** Strefa czasowa z profilu (IANA), do godzin w nagłówku. */
  timezone: string;
  /** Wywoływane po każdej zmianie zadań, żeby kalendarz odświeżył liczniki. */
  onChanged: () => void;
  /** „Edytuj”: rodzic zamyka panel i otwiera BlockForm + ScopeDialog (te same przepływy co po kliknięciu w kalendarzu). */
  onEdit: () => void;
  /** „Usuń”: rodzic zamyka panel i otwiera ScopeDialog usuwania. */
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Panel wystąpienia bloku: szuflada z prawej na desktopie, z dołu na mobile. Każde wystąpienie ma własną
 * listę zadań (klucz: blockId + occurrenceDate). Zmiany są optymistyczne i wracają do stanu sprzed zmiany
 * z toastem błędu, gdy serwer je odrzuci.
 */
export function BlockPanel({ occurrence, timezone, onChanged, onEdit, onDelete, onClose }: BlockPanelProps) {
  const isMobile = useIsMobile();
  const { blockId, occurrenceDate } = occurrence;
  const [tasks, setTasks] = useState<BlockTask[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const color = categoryColor(occurrence.color);
  const progress = taskProgress(tasks ?? []);

  // Wczytanie listy zadań. Rodzic montuje panel z `key` wystąpienia, więc każde wystąpienie zaczyna od pustego stanu;
  // `cancelled` chroni przed odpowiedzią po zamknięciu panelu.
  useEffect(() => {
    let cancelled = false;
    listTasks(blockId, occurrenceDate)
      .then((rows) => {
        if (!cancelled) setTasks(rows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTasks([]);
        toastManager.add({
          type: "error",
          title: "Nie udało się wczytać zadań",
          description: error instanceof Error ? error.message : undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [blockId, occurrenceDate]);

  function showError(title: string, error: unknown) {
    toastManager.add({ type: "error", title, description: error instanceof Error ? error.message : undefined });
  }

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    try {
      const task = await addTask(blockId, occurrenceDate, title);
      setTasks((current) => [...(current ?? []), task]);
      onChanged();
    } catch (error) {
      setNewTitle(title);
      showError("Nie udało się dodać zadania", error);
    }
  }

  // Optymistyczne odhaczenie: stan zmienia się od razu, a przy błędzie wraca do poprzedniej wartości.
  async function handleToggle(task: BlockTask, done: boolean) {
    setTasks((current) => current?.map((t) => (t.id === task.id ? { ...t, done } : t)) ?? null);
    try {
      await toggleTask(task.id, done);
      onChanged();
    } catch (error) {
      setTasks((current) => current?.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)) ?? null);
      showError("Nie udało się zapisać zadania", error);
    }
  }

  async function handleRename() {
    if (!editing) return;
    const { id, title } = editing;
    const trimmed = title.trim();
    setEditing(null);
    const task = tasks?.find((t) => t.id === id);
    if (!task || !trimmed || trimmed === task.title) return;
    setTasks((current) => current?.map((t) => (t.id === id ? { ...t, title: trimmed } : t)) ?? null);
    try {
      await renameTask(id, trimmed);
      onChanged();
    } catch (error) {
      setTasks((current) => current?.map((t) => (t.id === id ? { ...t, title: task.title } : t)) ?? null);
      showError("Nie udało się zapisać zadania", error);
    }
  }

  async function handleDelete(task: BlockTask) {
    const index = tasks?.findIndex((t) => t.id === task.id) ?? -1;
    setTasks((current) => current?.filter((t) => t.id !== task.id) ?? null);
    try {
      await deleteTask(task.id);
      onChanged();
    } catch (error) {
      // Wstawiamy zadanie z powrotem na dawne miejsce.
      setTasks((current) => (current ? current.toSpliced(Math.max(index, 0), 0, task) : [task]));
      showError("Nie udało się usunąć zadania", error);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetPopup
        side={isMobile ? "bottom" : "right"}
        className="md:max-w-[400px]"
        closeProps={{ "aria-label": "Zamknij panel" }}
      >
        <div className="flex items-start gap-3 p-5 pe-14 max-md:p-4 max-md:pe-14">
          <span aria-hidden="true" className="mt-1.5 size-3.5 shrink-0 rounded-[4px]" style={{ background: color.bar }} />
          <div className="min-w-0">
            <SheetTitle className="text-[22px] leading-tight break-words">{occurrence.title}</SheetTitle>
            <p className="mt-1 text-sm text-muted-foreground">{occurrenceHeading(occurrence, timezone)}</p>
            {occurrence.recurring && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                <RepeatIcon aria-hidden="true" className="size-3" />
                Powtarzany
              </span>
            )}
          </div>
        </div>

        <SheetPanel className="pt-0">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Zadania na to wystąpienie</h3>
            <span className="text-sm text-muted-foreground tabular-nums" data-testid="task-counter">
              {progress.label}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Postęp zadań"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.percent)}
          >
            <div className="h-full rounded-full transition-[width]" style={{ width: `${progress.percent}%`, background: color.bar }} />
          </div>

          <ul className="mt-3 flex flex-col" aria-label="Lista zadań">
            {tasks?.map((task) => (
              <li key={task.id} className="flex min-h-14 items-center gap-3 border-b border-border/60 md:min-h-11">
                <Checkbox
                  className="size-[22px] md:size-[18px]"
                  aria-label={task.title}
                  checked={task.done}
                  onCheckedChange={(checked) => void handleToggle(task, checked === true)}
                />
                {editing?.id === task.id ? (
                  <Input
                    autoFocus
                    aria-label="Nazwa zadania"
                    value={editing.title}
                    onChange={(e) => setEditing({ id: task.id, title: e.target.value })}
                    onBlur={() => void handleRename()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename();
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 flex-1 truncate py-2 text-start text-[15px]",
                      task.done && "text-muted-foreground line-through",
                    )}
                    onClick={() => setEditing({ id: task.id, title: task.title })}
                  >
                    {task.title}
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Usuń zadanie ${task.title}`}
                  onClick={() => void handleDelete(task)}
                >
                  <TrashIcon aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>

          <Input
            className="mt-3"
            aria-label="Dodaj zadanie"
            placeholder="Dodaj zadanie i naciśnij Enter"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <p className="mt-2 text-xs text-muted-foreground">Każde powtórzenie tego bloku ma własną, pustą listę.</p>

          {occurrence.note && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">Notatka</h3>
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{occurrence.note}</p>
            </div>
          )}
        </SheetPanel>

        <div className="flex gap-2 border-t p-4">
          <Button className="flex-1" variant="outline" onClick={onEdit}>
            {isMobile ? "Edytuj blok" : "Edytuj"}
          </Button>
          <Button variant="destructive-outline" onClick={onDelete}>
            <TrashIcon aria-hidden="true" />
            Usuń blok
          </Button>
        </div>
      </SheetPopup>
    </Sheet>
  );
}
