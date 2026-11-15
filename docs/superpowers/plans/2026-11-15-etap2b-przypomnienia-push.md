# Etap 2b: przypomnienia push o nawykach — plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cel:** nawyk może mieć godzinę przypomnienia. O tej godzinie (w strefie z profilu) telefon albo komputer dostaje powiadomienie push, chyba że nawyk jest już dziś odhaczony albo dziś niezaplanowany.

**Architektura:**
- **Baza decyduje, kogo przypomnieć.** `pg_cron` co minutę wywołuje funkcję SQL `claim_due_habit_reminders(now())`. Funkcja:
  - wybiera nawyki, którym właśnie wypada przypomnienie, razem z subskrypcjami push ich właścicieli;
  - w tej samej instrukcji oznacza je jako przypomniane dziś, więc nic nie wyśle się dwa razy.
- **Wysyłka.** Gdy funkcja coś zwróci, `pg_net` wysyła wynik POST-em na `/api/cron/przypomnienia` z tajnym tokenem. Endpoint (Next.js, runtime Node) wysyła powiadomienia biblioteką `web-push` z kluczami VAPID.
- **Martwe subskrypcje.** Subskrypcje, dla których usługa push odpowie 404 lub 410, endpoint usuwa przez RPC `remove_push_subscriptions(secret, endpoints)`. Ta funkcja sprawdza token w Supabase Vault. Nigdzie nie używamy `service_role`.
- **Strona klienta.** Service worker `public/sw.js` pokazuje powiadomienie i po kliknięciu otwiera `/dzis`.

**Stack:** Next.js 16 (cacheComponents), Supabase Postgres + RLS (Clerk JWT `sub`), `pg_cron` + `pg_net` + Vault na Supabase, `web-push` (npm), Vitest, testy SQL przez `scripts/test-db.sh`.

**Spec:** `docs/superpowers/specs/2026-11-13-life-organizer-design.md` (v2): 4.3 „Przypomnienia”, 5 (`habits.remind_at`, `push_subscriptions`), 8 pkt 3.

## Global Constraints

- **Wymóg ze spec 4.3:** przypomnienie nie przychodzi, jeśli nawyk na dziś jest już odhaczony albo dziś nie jest zaplanowany. „Dziś” i godzina liczone są w `profiles.timezone`.
- **Co znaczy „zaplanowany dziś”:**
  - `daily`: zawsze;
  - `days`: gdy dzisiejszy dzień ISO (1 = pn … 7 = nd) jest w `weekdays`;
  - `weekly`: gdy w bieżącym tygodniu ISO (pn–nd) liczba odhaczeń jest mniejsza niż `times_per_week`;
  - `none`: nigdy. Dla `none` pole przypomnienia jest ukryte, a zapis ustawia `remind_at = null`.
- **Okno wysyłki:**
  - przypomnienie wypada, gdy `remind_at <= czas lokalny < remind_at + 15 min` i `last_reminded_on` jest różne od dziś (lokalnie);
  - godzina z dokładnością do minuty (`HH:mm`);
  - nawyk zarchiwizowany (`archived_at <= dziś`) albo utworzony po dziś nie dostaje przypomnień.
- **Brak subskrypcji:** gdy użytkownik nie ma żadnej subskrypcji, nawyk nie jest oznaczany jako przypomniany.
- **Treść powiadomienia** (PL):
  - tytuł „Rhytm”, treść „Pora na: {nazwa nawyku}”;
  - `tag` = id nawyku (nowe powiadomienie zastępuje stare dla tego samego nawyku);
  - kliknięcie otwiera `/dzis`.
- **iOS:** przy włączaniu powiadomień na iPhonie/iPadzie bez trybu PWA (`display-mode: standalone`) aplikacja pokazuje zdanie: „Na iPhonie powiadomienia działają po dodaniu Rhytm do ekranu głównego (Udostępnij → Do ekranu początkowego, iOS 16.4+).”
- **Sekrety:**
  - `VAPID_PRIVATE_KEY` i `CRON_SECRET` tylko w zmiennych środowiskowych (Vercel, `.env.local`), nigdy w repo ani w czacie;
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` jest jawny, a `VAPID_SUBJECT` = `mailto:` właściciela;
  - w Supabase Vault są sekrety `rhytm_cron_secret` (ta sama wartość co `CRON_SECRET`) i `rhytm_app_url` (np. `https://rhytm.vercel.app`);
  - tworzy je Mejson w SQL Editorze, nie kontroler.
- **Bez `service_role`.** Funkcje uprzywilejowane to `SECURITY DEFINER` z `set search_path = ''` i odebranym `execute` od `public`/`anon`/`authenticated`. Wyjątek: `remove_push_subscriptions` ma `execute` dla `anon`, bo sprawdza token.
- **Wzorce projektu:**
  - akcje serwera zwracają `ActionResult` (`src/lib/action-result.ts`) i po zapisie wywołują `revalidatePath("/dzis")` oraz `revalidatePath("/nawyki")`;
  - teksty UI po polsku;
  - aliasy w SQL zawsze z `AS`;
  - mało funkcji pomocniczych (Mejson woli kod czytany od góry do dołu);
  - przed użyciem API Next przeczytaj `node_modules/next/dist/docs` (AGENTS.md), a dla PWA i web push `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`.

## Review Focus

1. **Strefa czasowa i zmiana czasu:** przypomnienie 08:00 w `Europe/Warsaw` wypada o 08:00 lokalnie także w dniu zmiany czasu (29 marca 2026). Test SQL w zadaniu 1.
2. **Godzina ustawiona „wstecz”:** nawyk z `remind_at` 07:00 zapisany o 09:00 nie dostaje przypomnienia od razu (poza oknem 15 min). Test SQL w zadaniu 1.
3. **Podwójne wywołanie crona w tej samej minucie:** drugie `claim` nic nie zwraca. Test SQL w zadaniu 1.
4. **Nawyk tygodniowy z wykonanym celem albo „w wybrane dni” w dzień wolny:** brak przypomnienia. Test SQL w zadaniu 1.
5. **Wygasła subskrypcja (410):** zostaje usunięta, a pozostałe urządzenia i tak dostają powiadomienie. Test endpointu w zadaniu 4.

---

### Task 1: Migracja 0004 — kolumny, `push_subscriptions`, funkcje SQL

**Files:**
- Create: `supabase/migrations/0004_habit_reminders.sql`
- Modify: `supabase/tests/00_shim.sql` (schemat `vault` z widokiem/tabelą `vault.decrypted_secrets(name text, decrypted_secret text)`)
- Create: `supabase/tests/reminders.test.sql`
- Modify: `scripts/test-db.sh` (uruchamia `reminders.test.sql`)

**Interfaces:**
- Produces:
  - `habits.remind_at time null`, `habits.last_reminded_on date null`.
  - Tabela `push_subscriptions`:
    - kolumny: `id uuid pk default gen_random_uuid()`, `user_id text not null default (auth.jwt()->>'sub')`, `endpoint text not null unique`, `p256dh text not null`, `auth text not null`, `created_at timestamptz default now()`;
    - RLS `push_subscriptions_own` (for all, `user_id = (select auth.jwt()->>'sub')`);
    - grant `select, delete` dla `authenticated` (bez `insert`: zapis tylko przez `save_push_subscription` z listą dozwolonych serwerów push; poprawka z przeglądu końcowego);
    - CHECK: `endpoint`, `p256dh`, `auth` niepuste i najwyżej 1000 znaków.
  - `public.claim_due_habit_reminders(p_now timestamptz) returns table(endpoint text, p256dh text, auth text, habit_id uuid, habit_name text)`:
    - `security definer`, `set search_path = ''`;
    - `execute` tylko dla właściciela (cron działa jako `postgres`);
    - w tej samej instrukcji (CTE `update … returning`) ustawia `last_reminded_on` na lokalny dzień wybranych nawyków.
  - `public.remove_push_subscriptions(p_secret text, p_endpoints text[]) returns int`:
    - `security definer`, `set search_path = ''`;
    - gdy `p_secret` jest różny od `rhytm_cron_secret` z `vault.decrypted_secrets` (albo sekret nie istnieje), rzuca błąd `'unauthorized'`;
    - w przeciwnym razie usuwa podane endpointy i zwraca ich liczbę;
    - `execute` dla `anon`.

- [ ] **Krok 1: Napisz testy SQL w `supabase/tests/reminders.test.sql`** (styl jak `habits_sleep.test.sql`, `raise exception` przy błędzie, na końcu `raise notice 'REMINDERS OK'`).
  - Dane: użytkownik `u1` ma profil z `timezone 'Europe/Warsaw'`, dwie subskrypcje i nawyki:
    - A: `daily`, 08:00;
    - B: `days {1}` (poniedziałek), 08:00;
    - C: `weekly 2`, 08:00, z 2 odhaczeniami w tym tygodniu;
    - D: `none` z wymuszonym `remind_at` 08:00;
    - E: `daily`, 08:00, odhaczony dziś;
    - F: `daily`, 08:00, zarchiwizowany.
  - Użytkownik `u2` bez subskrypcji ma nawyk `daily` 08:00.
  - Asercje:
    - `claim_due_habit_reminders('2026-11-17 07:05+00')` (wtorek 08:05 w Warszawie) zwraca dokładnie 2 wiersze, oba dla A (po jednym na subskrypcję);
    - drugie wywołanie z tym samym czasem zwraca 0 wierszy;
    - `u2`: `last_reminded_on` jest nadal `null`;
    - `'2026-11-17 06:59+00'` (07:59 lokalnie) dla świeżego nawyku 08:00 zwraca 0 wierszy;
    - `'2026-11-17 07:15+00'` (08:15, koniec okna) zwraca 0 wierszy;
    - zmiana czasu: nawyk 08:00 i `'2026-03-29 06:00+00'` (08:00 CEST) zwraca wiersz;
    - poniedziałek `'2026-11-16 07:05+00'`: nawyk B wypada.
  - Uprawnienia i bezpieczeństwo:
    - jako `authenticated` wywołanie `claim_…` kończy się błędem uprawnień;
    - `remove_push_subscriptions('zly', …)` rzuca `unauthorized`;
    - z poprawnym sekretem usuwa 1 i zwraca 1;
    - RLS: `u2` nie widzi subskrypcji `u1`.
- [ ] **Krok 2:** `npm run test:db`. Oczekiwane: błąd (brak funkcji/tabel).
- [ ] **Krok 3: Napisz migrację `0004_habit_reminders.sql`** zgodnie z Interfaces i Global Constraints. Logika `claim` w jednym SQL:
  - czas lokalny to `p_now at time zone p.timezone`;
  - harmonogram to wersja z największym `valid_from <= dzień lokalny`;
  - tydzień dla `weekly` liczony przez `date_trunc('week', …)`;
  - dzień ISO przez `extract(isodow …)`;
  - nawyk musi mieć co najmniej jedną subskrypcję (`exists`).
- [ ] **Krok 4:** `npm run test:db`. Oczekiwane: `RLS OK`, `CATEGORIES OK`, `HABITS_SLEEP OK`, `REMINDERS OK`.
- [ ] **Krok 5: Commit** `feat(db): przypomnienia nawyków i subskrypcje push (0004)`.

### Task 2: Godzina przypomnienia w nawykach (logika + akcje + okno)

**Files:**
- Modify:
  - `src/lib/habits/types.ts` (`HabitHistory.remindAt: string | null`, format `HH:mm`);
  - `src/lib/habits/rules.ts` (`validateHabitInput` przyjmuje `remindAt` i zwraca go znormalizowanego);
  - `src/lib/habits/load.ts` (czyta `remind_at`, ucina do `HH:mm`);
  - `src/app/(app)/nawyki/habit-actions.ts` (`HabitInput.remindAt`; zapis `remind_at` w `createHabit`/`updateHabit`; zmiana godziny zeruje `last_reminded_on`);
  - `src/components/habits/HabitDialog.tsx`;
  - `src/components/habits/HabitList.tsx` (ikona dzwonka `Bell` z lucide i godzina w metadanych wiersza).
- Test: `src/lib/habits/rules.test.ts`.

**Interfaces:**
- Consumes: kolumna `habits.remind_at` (Task 1).
- Produces:
  - `validateHabitInput({ name, type, weekdays, timesPerWeek, remindAt })` zwraca `{ name, schedule, remindAt: string | null }`;
  - `HabitHistory.remindAt`.

- [ ] **Krok 1: Testy w `rules.test.ts`:**
  - `remindAt '07:30'` przechodzi jako `'07:30'`;
  - `'7:30'`, `'24:00'`, `'07:60'` oraz liczba (zamiast tekstu) rzucają „Nieprawidłowa godzina przypomnienia”;
  - `null` przechodzi jako `null`;
  - typ `none` z `remindAt '08:00'` zwraca `remindAt: null`.
- [ ] **Krok 2:** `npx vitest run src/lib/habits/rules.test.ts`. Oczekiwane: FAIL.
- [ ] **Krok 3: Implementacja `rules.ts`, `types.ts`, `load.ts`, akcji.** Dotychczasowe wywołania, które nie podają `remindAt`, traktuj jak `null`.
- [ ] **Krok 4: `HabitDialog`.** Pod harmonogramem dodaj sekcję „Przypomnienie”:
  - przełącznik „Bez przypomnienia / O godzinie” z polem `<input type="time" step="60">` (domyślnie 08:00);
  - sekcja ukryta dla „bez planu”;
  - gdy na tym urządzeniu nie ma aktywnej subskrypcji (`Notification.permission !== 'granted'` albo brak `pushManager.getSubscription()`), pod polem dopisek „Włącz powiadomienia w Ustawieniach, żeby przypomnienia działały na tym urządzeniu.” z linkiem do `/ustawienia`.
- [ ] **Krok 5:** `npm test` i `npx tsc --noEmit`. Oczekiwane: wszystko przechodzi.
- [ ] **Krok 6: Commit** `feat(nawyki): godzina przypomnienia w oknie nawyku`.

### Task 3: Service worker i włączanie powiadomień w Ustawieniach

**Files:**
- Create:
  - `public/sw.js`;
  - `src/lib/push/subscription.ts` + `subscription.test.ts`;
  - `src/app/(app)/ustawienia/push-actions.ts`;
  - `src/components/settings/PushToggle.tsx`.
- Modify: `src/app/(app)/ustawienia/page.tsx` (sekcja „Powiadomienia”), `.env.local.example` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=`, `VAPID_SUBJECT=mailto:`, `CRON_SECRET=`).

**Interfaces:**
- Consumes: tabela `push_subscriptions` (Task 1).
- Produces:
  - `validatePushSubscription(input: unknown): { endpoint: string; p256dh: string; auth: string }`:
    - rzuca „Nieprawidłowa subskrypcja” przy złym kształcie;
    - endpoint musi zaczynać się od `https://`;
    - każde pole niepuste i nie dłuższe niż 1000 znaków.
  - `savePushSubscription(input: unknown): Promise<ActionResult<null>>` robi upsert po `endpoint`.
  - `removePushSubscription(endpoint: string): Promise<ActionResult<null>>`.

- [ ] **Krok 1: Testy `subscription.test.ts`:**
  - poprawny obiekt `{ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'a', auth: 'b' } }` daje płaski wynik;
  - `http://` endpoint, brak `keys`, puste `auth`, `null` i endpoint o 1001 znakach rzucają „Nieprawidłowa subskrypcja”.
- [ ] **Krok 2:** `npx vitest run src/lib/push`. Oczekiwane: FAIL.
- [ ] **Krok 3: Implementacja `subscription.ts` i `push-actions.ts`.** Klient Supabase z `@/lib/supabase/server`; `user_id` ustawia default w bazie.
- [ ] **Krok 4: `public/sw.js`.**
  - `push`: `event.data.json()` → `showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url } })`;
  - `notificationclick`: zamyka powiadomienie, skupia otwartą kartę aplikacji albo otwiera `data.url`.
- [ ] **Krok 5: `PushToggle` (klient).** Stany i teksty:
  - brak `serviceWorker`/`PushManager`: „Ta przeglądarka nie obsługuje powiadomień.”;
  - iOS (UA zawiera iPhone/iPad) bez trybu standalone: zdanie o iOS z Global Constraints, bez przycisku;
  - `permission === 'denied'`: „Powiadomienia są zablokowane w ustawieniach przeglądarki.”;
  - brak subskrypcji: przycisk „Włącz powiadomienia” (rejestruje `/sw.js`, `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY })`, potem `savePushSubscription(sub.toJSON())`);
  - jest subskrypcja: „Powiadomienia włączone na tym urządzeniu” i przycisk „Wyłącz” (`removePushSubscription` + `unsubscribe()`);
  - błąd akcji pokazuj jako tekst pod przyciskiem.
- [ ] **Krok 6:** `npm test`, `npx tsc --noEmit`, `npm run build`. Oczekiwane: wszystko przechodzi.
- [ ] **Krok 7: Commit** `feat(push): service worker i włączanie powiadomień`.

### Task 4: Endpoint `/api/cron/przypomnienia`

**Files:**
- Create: `src/app/api/cron/przypomnienia/route.ts`, `src/app/api/cron/przypomnienia/route.test.ts`.
- Modify: `src/proxy.ts` (dodaj `"/api/cron(.*)"` do tras publicznych; endpoint sam sprawdza token), `package.json` (`web-push`, `@types/web-push`).

**Interfaces:**
- Consumes:
  - wiersze `claim_due_habit_reminders` (Task 1) jako body;
  - `remove_push_subscriptions` (Task 1).
- Produces:
  - `POST` z nagłówkiem `Authorization: Bearer <CRON_SECRET>` i body `{ "reminders": [{ endpoint, p256dh, auth, habit_id, habit_name }] }`;
  - odpowiedź `200 { sent, failed, removed }`;
  - `401 { error: 'unauthorized' }` przy złym albo pustym tokenie, także gdy `CRON_SECRET` nie jest ustawiony;
  - `400` przy złym body.

- [ ] **Krok 1: Testy `route.test.ts`** (Vitest, `vi.mock('web-push')` i mock klienta Supabase `rpc`):
  - zły token daje 401 i `sendNotification` nie jest wołane;
  - brak `CRON_SECRET` w env daje 401;
  - 2 przypomnienia, z czego jedno kończy się błędem `statusCode 410`: odpowiedź `{ sent: 1, failed: 1, removed: 1 }`, a `rpc` dostało `('remove_push_subscriptions', { p_secret: CRON_SECRET, p_endpoints: [ten endpoint] })`;
  - błąd 500 od usługi push liczy się jako `failed`, ale nie trafia do usuwania;
  - payload `sendNotification` po `JSON.parse` to `{ title: 'Rhytm', body: 'Pora na: Woda', tag: habit_id, url: '/dzis' }`.
- [ ] **Krok 2:** `npx vitest run src/app/api/cron`. Oczekiwane: FAIL.
- [ ] **Krok 3: Implementacja.**
  - `export const runtime = 'nodejs'`;
  - porównanie tokenu przez `crypto.timingSafeEqual` (najpierw sprawdź równą długość);
  - `webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`;
  - wysyłka przez `Promise.allSettled`, `TTL: 3600`;
  - klient Supabase anon (`createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` lub nazwa używana w `src/lib/supabase`) tylko do `rpc` usuwania, wołany wyłącznie gdy są endpointy 404/410.
- [ ] **Krok 4:** `npm test`, `npx tsc --noEmit`, `npm run build`. Oczekiwane: wszystko przechodzi.
- [ ] **Krok 5: Commit** `feat(push): endpoint wysyłki przypomnień`.

### Task 5: Konfiguracja crona, wdrożenie na Vercel, README

**Files:**
- Create: `supabase/setup/przypomnienia-cron.sql` (uruchamia Mejson w SQL Editorze; nie jest migracją, bo lokalna baza testowa nie ma `pg_cron`/`pg_net`).
- Modify: `README.md` (sekcja „Wdrożenie na Vercel i przypomnienia push”).

- [ ] **Krok 1: `przypomnienia-cron.sql`:**
  - `create extension if not exists pg_cron; create extension if not exists pg_net;`;
  - w komentarzu instrukcja tworzenia sekretów: `select vault.create_secret('<wartość>', 'rhytm_cron_secret'); select vault.create_secret('https://<adres>', 'rhytm_app_url');`, wartości wpisuje Mejson;
  - `select cron.unschedule('rhytm-przypomnienia') where exists (…);`, żeby plik dało się uruchomić ponownie;
  - `cron.schedule('rhytm-przypomnienia', '* * * * *', $$ … $$)`. Ciało joba:
    - `with due as (select * from public.claim_due_habit_reminders(now()))`;
    - `select net.http_post(url := (select decrypted_secret from vault.decrypted_secrets where name = 'rhytm_app_url') || '/api/cron/przypomnienia', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select … 'rhytm_cron_secret')), body := jsonb_build_object('reminders', jsonb_agg(to_jsonb(due))), timeout_milliseconds := 10000) from due having count(*) > 0;`
    - aliasy z `AS`.
- [ ] **Krok 2: README, kroki po kolei** (w tej kolejności):
  1. wygeneruj klucze `npx web-push generate-vapid-keys` oraz `openssl rand -hex 32` dla `CRON_SECRET`;
  2. Vercel: import repo z GitHuba i zmienne środowiskowe (wszystkie z `.env.local.example` plus VAPID i `CRON_SECRET`, przekierowania Clerk na `/dzis`), potem deploy;
  3. Clerk: dodaj domenę Vercela w dashboardzie, jeśli jest wymagana dla instancji;
  4. Supabase: Database → Extensions (pg_cron, pg_net), sekrety Vault, uruchom `supabase/setup/przypomnienia-cron.sql`;
  5. na telefonie: otwórz adres, na iPhonie „Do ekranu początkowego”, Ustawienia → „Włącz powiadomienia”, ustaw nawykowi godzinę za 2–3 minuty i poczekaj;
  6. diagnostyka: `select * from cron.job_run_details order by start_time desc limit 5;` i `select * from net._http_response order by created desc limit 5;`.
- [ ] **Krok 3:** `npm test`, `npm run test:db`, `npm run build`. Oczekiwane: wszystko przechodzi.
- [ ] **Krok 4: Commit** `docs: wdrożenie na Vercel i konfiguracja przypomnień push`.
