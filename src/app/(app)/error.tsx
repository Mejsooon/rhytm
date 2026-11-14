"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Granica błędów dla wszystkich zakładek aplikacji (Kalendarz, Sport, Nawyki, Ustawienia).
// Najczęstsza przyczyna w nowej instalacji: Supabase nie widzi tokenu Clerka (patrz README, krok 3).
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-4 py-10 md:px-6">
      <h1 className="font-heading text-xl font-bold tracking-tight">Coś poszło nie tak</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Nie udało się wczytać tej strony. Spróbuj ponownie za chwilę. Jeśli błąd wraca, sprawdź połączenie z bazą danych.
      </p>
      <Button onClick={() => retry()}>Spróbuj ponownie</Button>
    </div>
  );
}
