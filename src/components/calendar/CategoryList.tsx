"use client";

import { PencilIcon, PlusIcon } from "lucide-react";
import { categoryColor } from "@/lib/calendar/colors";
import type { Category } from "@/lib/categories/categories";
import { cn } from "@/lib/utils";

type CategoryListProps = {
  categories: Category[];
  /** Liczba bloków w widocznym zakresie, po id kategorii. */
  counts: Record<string, number>;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onEdit: (category: Category) => void;
};

export function CategoryList({ categories, counts, onToggle, onAdd, onEdit }: CategoryListProps) {
  return (
    <div className="flex flex-col gap-px">
      <span className="px-2.5 pb-1.5 text-[11px] font-medium tracking-[0.04em] text-[#9B9A97] uppercase">
        Kategorie
      </span>

      {categories.map((category) => {
        const dot = categoryColor(category.color).dot;
        return (
          <div key={category.id} className="group relative">
            <button
              type="button"
              aria-pressed={category.visible}
              title="Pokaż / ukryj kategorię"
              onClick={() => onToggle(category.id)}
              className={cn(
                "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm outline-none hover:bg-[#EFEFED]/60 focus-visible:ring-2 focus-visible:ring-ring",
                category.visible ? "text-[#5F5E5B]" : "text-[#B8B7B4]",
              )}
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full border-[1.5px] box-border"
                style={category.visible ? { background: dot, borderColor: dot } : { background: "transparent", borderColor: dot }}
              />
              <span className="min-w-0 flex-1 truncate">{category.name}</span>
              <span className="text-xs text-[#9B9A97] group-has-[:focus-visible]:opacity-0 group-hover:opacity-0">
                {counts[category.id] ?? 0}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Edytuj kategorię ${category.name}`}
              onClick={() => onEdit(category)}
              className="absolute top-1 right-1.5 flex size-6 items-center justify-center rounded-md text-[#7D7C78] opacity-0 outline-none group-has-[:focus-visible]:opacity-100 group-hover:opacity-100 hover:bg-[#EFEFED] hover:text-[#191816] focus-visible:ring-2 focus-visible:ring-ring"
            >
              <PencilIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onAdd}
        className="flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-[#9B9A97] outline-none hover:text-[#191816] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PlusIcon aria-hidden="true" className="size-2.5" strokeWidth={2.4} />
        Dodaj kategorię
      </button>
    </div>
  );
}
