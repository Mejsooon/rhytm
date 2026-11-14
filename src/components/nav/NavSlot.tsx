"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Wstawia dzieci do paska bocznego (#rh-nav-slot). Portal dopiero po montażu,
// żeby serwer i klient renderowały to samo. Gdy elementu nie ma (np. brak paska), nic nie robi.
export function NavSlot({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("rh-nav-slot");
    // Poniżej md pasek jest ukryty (display: none), więc nie ma po co renderować.
    setTarget(el && el.offsetParent !== null ? el : null);
    return () => setTarget(null);
  }, []);

  return target ? createPortal(children, target) : null;
}
