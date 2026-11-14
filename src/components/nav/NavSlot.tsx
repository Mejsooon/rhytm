"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Wstawia dzieci do paska bocznego (#rh-nav-slot). Portal dopiero po montażu,
// żeby serwer i klient renderowały to samo. Gdy elementu nie ma (np. brak paska), nic nie robi.
export function NavSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Poniżej md pasek jest ukryty przez CSS, więc wstawiona treść też jest ukryta.
    setTarget(document.getElementById("rh-nav-slot"));
    return () => setTarget(null);
  }, []);

  return target ? createPortal(children, target) : null;
}
