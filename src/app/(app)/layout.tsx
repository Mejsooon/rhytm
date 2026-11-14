import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppNav } from "@/components/nav/AppNav";
import { createServerClient } from "@/lib/supabase/server";

// Zakłada wiersz profilu przy pierwszym wejściu użytkownika (kolejne wejścia go nie zmieniają)
// i zwraca aktualny profil. Nie jest eksportowana, bo plik layout.tsx dopuszcza tylko eksporty Next.js.
async function ensureProfile() {
  const { userId } = await auth();
  const supabase = await createServerClient();
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId! }, { onConflict: "user_id", ignoreDuplicates: true });
  if (upsertError) throw new Error(`ensureProfile: ${upsertError.message}`);
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId!).single();
  if (error) throw new Error(`ensureProfile: ${error.message}`);
  return data;
}

// Komponent bez wyglądu: wywołuje ensureProfile przy renderze, poza statycznym szkieletem strony.
async function ProfileGate() {
  await ensureProfile();
  return null;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-1">
      <AppNav />
      <div className="min-w-0 flex-1 pb-[84px] md:pb-0">
        <Suspense fallback={null}>
          <ProfileGate />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
