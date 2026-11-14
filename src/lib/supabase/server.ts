import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

// Klient serwerowy: token sesji Clerka trafia do Supabase jako accessToken,
// więc RLS widzi `auth.jwt()->>'sub'` jako ID użytkownika.
export async function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => (await auth()).getToken() },
  );
}
