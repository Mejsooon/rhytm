import { Suspense } from "react";
import { MainCalendar } from "@/components/calendar/MainCalendar";
import { getProfile } from "../ustawienia/actions";

// Strefa czasowa pochodzi z profilu (dane dynamiczne), więc czytamy ją wewnątrz Suspense.
async function Calendar() {
  const profile = await getProfile();
  return <MainCalendar timezone={profile.timezone} />;
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
