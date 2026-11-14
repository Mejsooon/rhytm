import { Suspense } from "react";
import { connection } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { getProfile } from "../ustawienia/actions";
import { listCategories } from "./category-actions";

// Strefa czasowa (z profilu) i kategorie to dane dynamiczne, więc czytamy je wewnątrz Suspense.
// Najpierw profil: listCategories też go zapewnia, a kolejno nie ścigają się dwa ensureProfile.
// „Dziś” liczymy tu, w czasie żądania (po connection()), a nie przez new Date() w renderze klienta.
async function Calendar() {
  const profile = await getProfile();
  const categories = await listCategories();
  await connection();
  const today = formatInTimeZone(new Date(), profile.timezone, "yyyy-MM-dd");
  return <CalendarWorkspace timezone={profile.timezone} initialCategories={categories} today={today} />;
}

export default function KalendarzPage() {
  return (
    <main className="h-[calc(100dvh-84px)] md:h-dvh">
      <Suspense fallback={<p className="p-6 text-muted-foreground">Ładowanie…</p>}>
        <Calendar />
      </Suspense>
    </main>
  );
}
