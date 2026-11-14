"use client";

import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { PlusIcon, TrashIcon, XIcon } from "lucide-react";
import { addTask, deleteTask, listTasks, renameTask, toggleTask, type BlockTask } from "@/app/(app)/kalendarz/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetPopup, SheetTitle } from "@/components/ui/sheet";
import { toastManager } from "@/components/ui/toast";
import { useIsMobile } from "@/hooks/use-media-query";
import { occurrenceHeading, taskProgress } from "@/lib/calendar/block-panel";
import type { CalendarOccurrence } from "@/lib/calendar/calendar-events";
import { categoryColor } from "@/lib/calendar/colors";
import type { Category } from "@/lib/categories/categories";
import { cn } from "@/lib/utils";
import { QUIET_BUTTON_DANGER, QUIET_BUTTON_LIGHT } from "./quiet-classes";

type BlockPanelProps = {
  occurrence: CalendarOccurrence;
  /** Kategoria bloku (nazwa i kolor w nagłówku); brak = kategoria nieznana, pokazujemy szary „Bez kategorii”. */
  category?: Category;
  /** Element z `position: relative`, w którym panel ląduje na desktopie (przy prawej krawędzi obszaru kalendarza). */
  container: HTMLElement | null;
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
 * Panel wystąpienia bloku: na desktopie 360 px przy prawej krawędzi obszaru kalendarza, bez przyciemnienia tła
 * (portal do `container`), na mobile szuflada od dołu. Każde wystąpienie ma własną
 * listę zadań (klucz: blockId + occurrenceDate). Zmiany są optymistyczne i wracają do stanu sprzed zmiany
 * z toastem błędu, gdy serwer je odrzuci.
 */
export function BlockPanel({ occurrence, category, container, timezone, onChanged, onEdit, onDelete, onClose }: BlockPanelProps) {
  const isMobile = useIsMobile();
  const { blockId, occurrenceDate } = occurrence;
  const [tasks, setTasks] = useState<BlockTask[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const color = categoryColor(category?.color ?? "gray");
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

  const Title = isMobile ? SheetTitle : DialogPrimitive.Title;

  const content = (
    <>
      <div className="flex items-start gap-2.5 p-[18px] max-md:pe-14">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-[#7D7C78]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: color.dot }} />
            {category?.name ?? "Bez kategorii"}
            {occurrence.recurring && <span>· powtarzanie</span>}
          </span>
          <Title className="font-sans text-[17px] leading-snug font-semibold break-words text-[#191816]">
            {occurrence.title}
          </Title>
          <p className="text-[13px] text-[#7D7C78]">{occurrenceHeading(occurrence, timezone)}</p>
        </div>
        {!isMobile && (
          <DialogPrimitive.Close
            aria-label="Zamknij panel"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#7D7C78] outline-none hover:bg-[#F4F4F3] hover:text-[#191816] focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon aria-hidden="true" className="size-[15px]" />
          </DialogPrimitive.Close>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-[18px]">
        <div className="flex items-center justify-between text-[13px]">
          <h3 className="font-medium">Zadania</h3>
          <span className="text-[#7D7C78] tabular-nums" data-testid="task-counter">
            {progress.label}
          </span>
        </div>
        <div
          className="mt-2 h-1 overflow-hidden rounded-sm bg-[#F0F0EE]"
          role="progressbar"
          aria-label="Postęp zadań"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.percent)}
        >
          <div className="h-full rounded-sm transition-[width]" style={{ width: `${progress.percent}%`, background: color.dot }} />
        </div>

        <ul className="mt-2 flex flex-col" aria-label="Lista zadań">
          {tasks?.length === 0 && <li className="px-1 py-2 text-[13px] text-[#9B9A97]">Brak zadań w tym wystąpieniu.</li>}
          {tasks?.map((task) => (
            <li key={task.id} className="flex min-h-12 items-center gap-2.5 rounded-md px-1 md:min-h-9">
              <Checkbox
                className="size-[22px] md:size-[15px]"
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
                    if (e.key === "Escape") {
                      // Esc kończy tylko edycję nazwy, panel zostaje.
                      e.stopPropagation();
                      setEditing(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={cn(
                    "min-w-0 flex-1 truncate py-1.5 text-start text-[13px]",
                    task.done && "text-[#9B9A97] line-through",
                  )}
                  onClick={() => setEditing({ id: task.id, title: task.title })}
                >
                  {task.title}
                </button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-[#9B9A97] hover:text-[#B4342F]"
                aria-label={`Usuń zadanie ${task.title}`}
                onClick={() => void handleDelete(task)}
              >
                <TrashIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>

        <label className="flex min-h-9 items-center gap-2.5 px-1 text-[#9B9A97]">
          <PlusIcon aria-hidden="true" className="size-[15px] shrink-0" />
          <input
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#191816] outline-none placeholder:text-[#9B9A97]"
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
        </label>
        <p className="mt-2 text-xs text-[#9B9A97]">Każde powtórzenie tego bloku ma własną, pustą listę.</p>

        {occurrence.note && (
          <div className="mt-[18px] flex flex-col gap-1 border-t border-[#F0F0EE] pt-3.5">
            <h3 className="text-xs text-[#7D7C78]">Notatka</h3>
            <p className="text-[13px] leading-normal whitespace-pre-wrap text-[#37352F]">{occurrence.note}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-[#F0F0EE] p-4">
        <Button className={cn(QUIET_BUTTON_LIGHT, "max-md:h-10 max-md:flex-1")} onClick={onEdit}>
          {isMobile ? "Edytuj blok" : "Edytuj"}
        </Button>
        <Button aria-label="Usuń blok" className={cn(QUIET_BUTTON_DANGER, "max-md:h-10")} onClick={onDelete}>
          <TrashIcon aria-hidden="true" className="md:hidden" />
          Usuń
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetPopup side="bottom" closeProps={{ "aria-label": "Zamknij panel" }}>
          {content}
        </SheetPopup>
      </Sheet>
    );
  }

  // Bez przyciemnienia i bez blokady kalendarza (modal={false}); zamykanie tylko X i Esc.
  return (
    <DialogPrimitive.Root open modal={false} disablePointerDismissal onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Popup className="absolute top-0 right-7 bottom-7 z-20 flex w-[360px] max-w-[calc(100%-56px)] flex-col overflow-hidden rounded-xl border border-[#EAEAE8] bg-white text-[#191816] shadow-[0_12px_32px_rgba(25,24,22,0.10)] outline-none">
          {content}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
