import { Suspense } from "react";
import { getProfile } from "./actions";
import { SettingsTabs } from "./profile-form";

// Dane profilu są dynamiczne, więc czytamy je wewnątrz Suspense.
async function Settings() {
  const profile = await getProfile();
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(profile.timezone)) timezones.unshift(profile.timezone);
  return <SettingsTabs profile={profile} timezones={timezones} />;
}

export default function UstawieniaPage() {
  return (
    <main className="p-6">
      <h1 className="mb-4 font-heading text-2xl font-extrabold tracking-tight">Ustawienia</h1>
      <Suspense fallback={<p className="text-muted-foreground">Ładowanie…</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}
