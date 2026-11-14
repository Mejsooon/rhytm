"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "@/lib/db/types";

// Hook kliencki: klient jest zapamiętany, a token pobierany przy każdym żądaniu.
export function useSupabase() {
  const { session } = useSession();
  return useMemo(
    () =>
      createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { accessToken: async () => session?.getToken() ?? null },
      ),
    [session],
  );
}
