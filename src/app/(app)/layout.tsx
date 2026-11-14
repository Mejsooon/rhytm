import { Suspense } from "react";
import { AppNav } from "@/components/nav/AppNav";
import { ensureProfile } from "@/lib/profile";

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
