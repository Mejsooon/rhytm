// GET /api/occurrences?from=YYYY-MM-DD&to=YYYY-MM-DD — wystąpienia bloków z licznikami zadań.
// Trasa jest chroniona przez Clerka (src/proxy.ts), a dane filtruje RLS w Supabase.
import { listOccurrences } from "@/lib/calendar/list-occurrences";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) {
    return Response.json({ error: "Nieprawidłowy zakres dat" }, { status: 400 });
  }
  try {
    return Response.json(await listOccurrences(from, to));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się wczytać kalendarza";
    return Response.json({ error: message }, { status: 500 });
  }
}
