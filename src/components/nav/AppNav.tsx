"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Activity, CalendarDays, CircleCheck, Settings, Sun } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";

// Zakładki główne: pełna etykieta na pasku bocznym, krótka na dolnym pasku.
const tabs = [
  { href: "/dzis", label: "Dziś", short: "Dziś", icon: Sun },
  { href: "/kalendarz", label: "Kalendarz", short: "Plan", icon: CalendarDays },
  { href: "/sport", label: "Sport", short: "Sport", icon: Activity },
  { href: "/nawyki", label: "Nawyki i sen", short: "Nawyki", icon: CircleCheck },
];

const itemClass =
  "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm text-[#5F5E5B] transition-colors hover:bg-accent/60";
const itemActiveClass = "bg-accent font-medium text-[#191816]";

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Pasek boczny od md w górę */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-[18px] md:flex">
        <div className="flex items-center gap-[9px] px-2 py-0.5">
          <LogoMark size={20} />
          <span className="font-heading text-[19px] font-extrabold tracking-[-0.04em]">rhytm</span>
        </div>
        <nav aria-label="Główna nawigacja" className="flex flex-col gap-px">
          <span className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[var(--faint)]">
            Ogólne
          </span>
          {tabs.map((tab) => {
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active && itemActiveClass)}
              >
                <tab.icon
                  className={cn("size-4", active ? "text-[#37352F]" : "text-[#7D7C78]")}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {/* Miejsce na sekcje wstawiane przez strony (NavSlot) */}
        <div id="rh-nav-slot" className="flex flex-col gap-5" />
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/ustawienia"
            aria-current={isActive("/ustawienia") ? "page" : undefined}
            className={cn(itemClass, isActive("/ustawienia") && itemActiveClass)}
          >
            <Settings
              className={cn("size-4", isActive("/ustawienia") ? "text-[#37352F]" : "text-[#7D7C78]")}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            Ustawienia
          </Link>
          <div className="flex items-center rounded-[10px] border border-sidebar-border bg-white p-2.5">
            <UserButton showName />
          </div>
        </div>
      </aside>

      {/* Dolny pasek poniżej md */}
      <nav
        aria-label="Główna nawigacja"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[84px] items-start justify-around border-t border-sidebar-border bg-white px-2 pt-2 pb-[max(env(safe-area-inset-bottom),16px)] md:hidden"
      >
        {[...tabs.map((t) => ({ href: t.href, label: t.short, icon: t.icon })), { href: "/ustawienia", label: "Ustawienia", icon: Settings }].map(
          (item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[10px] text-xs text-[#5F5E5B]",
                  active && itemActiveClass,
                )}
              >
                <item.icon
                  className={cn("size-5", active ? "text-[#37352F]" : "text-[#7D7C78]")}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                {item.label}
              </Link>
            );
          },
        )}
      </nav>
    </>
  );
}
