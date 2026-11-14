"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Activity, CalendarDays, CircleCheck, Settings } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { cn } from "@/lib/utils";

// Zakładki główne: pełna etykieta na pasku bocznym, krótka na dolnym pasku.
const tabs = [
  { href: "/kalendarz", label: "Kalendarz", short: "Plan", icon: CalendarDays, color: "var(--info)" },
  { href: "/sport", label: "Sport", short: "Sport", icon: Activity, color: "#B64E10" },
  { href: "/nawyki", label: "Nawyki i sen", short: "Nawyki", icon: CircleCheck, color: "#05893E" },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Pasek boczny od md w górę */}
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-background p-3 md:flex">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <LogoMark size={28} />
          <span className="font-heading text-xl font-extrabold tracking-tight">rhytm</span>
        </div>
        <nav aria-label="Główna nawigacja" className="mt-4 flex flex-col gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive(tab.href) ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-[#F0EEEB]/60",
                isActive(tab.href) && "bg-[#F0EEEB] text-foreground",
              )}
            >
              <tab.icon className="size-5" style={{ color: tab.color }} aria-hidden="true" />
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            href="/ustawienia"
            aria-current={isActive("/ustawienia") ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-foreground/80 transition-colors hover:bg-[#F0EEEB]/60",
              isActive("/ustawienia") && "bg-[#F0EEEB] text-foreground",
            )}
          >
            <Settings className="size-5 text-muted-foreground" aria-hidden="true" />
            Ustawienia
          </Link>
          <div className="flex h-10 items-center px-3">
            <UserButton />
          </div>
        </div>
      </aside>

      {/* Dolny pasek poniżej md */}
      <nav
        aria-label="Główna nawigacja"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[84px] items-start justify-around border-t border-border bg-white px-2 pt-2 pb-[max(env(safe-area-inset-bottom),16px)] md:hidden"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive(tab.href) ? "page" : undefined}
            className={cn(
              "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[10px] text-xs font-medium text-muted-foreground",
              isActive(tab.href) && "bg-[#F0EEEB] text-foreground",
            )}
          >
            <tab.icon className="size-5" style={{ color: tab.color }} aria-hidden="true" />
            {tab.short}
          </Link>
        ))}
        <Link
          href="/ustawienia"
          aria-current={isActive("/ustawienia") ? "page" : undefined}
          className={cn(
            "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[10px] text-xs font-medium text-muted-foreground",
            isActive("/ustawienia") && "bg-[#F0EEEB] text-foreground",
          )}
        >
          <Settings className="size-5" aria-hidden="true" />
          Ustawienia
        </Link>
      </nav>
    </>
  );
}
