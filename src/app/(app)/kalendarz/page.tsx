import { Suspense } from "react";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import { getProfile } from "../ustawienia/actions";
import { listCategories } from "./category-actions";

// Strefa czasowa (z profilu) i kategorie to dane dynamiczne, więc czytamy je wewnątrz Suspense.
// Najpierw profil: listCategories też go zapewnia, a kolejno nie ścigają się dwa ensureProfile.
async function Calendar() {
  const profile = await getProfile();
  const categories = await listCategories();
  return <CalendarWorkspace timezone={profile.timezone} initialCategories={categories} />;
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
