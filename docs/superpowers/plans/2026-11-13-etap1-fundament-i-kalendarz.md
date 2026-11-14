# Etap 1: Fundament + kalendarz główny — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Działająca aplikacja z logowaniem, profilem, nawigacją (PWA) i pełnym kalendarzem głównym: bloki czasowe, powtarzanie, zadania w każdym wystąpieniu.

**Architecture:** Next.js (App Router) + Clerk (konta, logowanie, rejestracja) + Supabase (Postgres, RLS; Clerk jako third-party auth). Logika kalendarza (rozwijanie powtórzeń, planowanie edycji „tylko to / to i następne / wszystkie”) to czyste funkcje TypeScript w `src/lib/calendar/`, w pełni pokryte testami. Warstwa danych (server actions) tylko wykonuje to, co zaplanują te funkcje. UI: coss ui + FullCalendar.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, coss ui (`npx shadcn@latest init @coss/style`), Clerk (`@clerk/nextjs`, `@clerk/localizations`, `@clerk/testing`), Supabase (`@supabase/supabase-js`, Supabase CLI lokalnie przez Docker), FullCalendar 7 (`@fullcalendar/react`, `core`, `timegrid`, `daygrid`, `interaction`), `date-fns` + `date-fns-tz`, Vitest, Playwright, pgTAP (`supabase test db`).

**Spec:** `docs/superpowers/specs/2026-11-13-life-organizer-design.md`

**Kolejne etapy (osobne plany, pisane po zakończeniu tego):** aktualna lista jest w specyfikacji, sekcja 8 (wersja 2 z 2026-11-14): Etap 1b: kalendarz w cichym stylu + kategorie. Etap 2: nawyki + sen + ekran Dziś. Etap 3: sport. Etap 4: rejestracja z pierwszymi krokami, szybkie dodawanie, wniosek tygodnia, telefon.

**Stan:** zrobione (PR #1, poprawka odczytu kalendarza w PR #2).

## Global Constraints

- Interfejs po polsku. Tydzień zaczyna się w poniedziałek, format 24h, jednostki metryczne.
- Strefa czasowa z profilu użytkownika, domyślnie `Europe/Warsaw`. Bloki cykliczne trzymane w czasie lokalnym: zmiana czasu letni/zimowy nie przesuwa godziny.
- Każda tabela z danymi użytkownika ma `user_id text not null default (auth.jwt()->>'sub')` (ID użytkownika Clerka) i politykę RLS `user_id = (select auth.jwt()->>'sub')`.
- Uwierzytelnianie wyłącznie przez Clerk; rejestracja otwarta. Supabase Auth nieużywany.
- Kalendarz główny jest całkowicie oddzielony od sportowego: osobne tabele, żadnych wspólnych zapytań.
- Każde wystąpienie powtarzanego bloku ma własną, pustą listę zadań. Zadania nie przechodzą dalej.
- Komponenty UI wyłącznie z coss ui (`src/components/ui/`). Brakujące elementy buduje się na Base UI w tym samym stylu.
- Styl kodu dla Mejsona: bez zbędnych małych funkcji pomocniczych. Wolimy jedną czytelną funkcję z komentarzami niż łańcuch skoków między helperami.

## Review Focus

1. **Zmiana czasu (DST):** blok „codziennie 08:00” w Europe/Warsaw ma 08:00 lokalnie także 30.03.2026 i 26.10.2026 → test w Task 5.
2. **Blok przez północ** (23:00–01:00): jedno wystąpienie, `occurrenceDate` = dzień startu, koniec następnego dnia → test w Task 5.
3. **„To i następne” na pierwszym wystąpieniu** działa jak „wszystkie”: nie powstaje seria z `until` przed startem → test w Task 6.
4. **„Tylko to” przesunięte na inny dzień:** zadania zostają przy tym wystąpieniu (klucz to oryginalna `occurrenceDate`) → test w Task 6.
5. **Dostęp do cudzych danych:** użytkownik B nie czyta ani nie zmienia bloków, wyjątków i zadań użytkownika A → test pgTAP w Task 2.

---

### Task 1: Szkielet projektu

**Files:**
- Create: projekt Next.js w katalogu repo (`src/app/`, `package.json`, `tsconfig.json`), `src/components/ui/*` (z coss ui), `vitest.config.ts`, `src/lib/sanity.test.ts`

**Interfaces:**
- Produces: alias importów `@/` → `src/`; skrypty npm `dev`, `build`, `lint`, `test` (vitest run), `test:e2e` (playwright).

- [ ] **Step 1:** `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (repo już zawiera `docs/`, więc trzeba zachować ten katalog).
- [ ] **Step 2:** `npx shadcn@latest init @coss/style`. Sprawdź, że `layout.tsx` używa zmiennych `--font-sans` / `--font-mono`, a nie `--font-geist-*`.
- [ ] **Step 3:** Zainstaluj Vitest (`vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`) i napisz test `sanity.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 4:** Run `npm test` → PASS. Run `npm run build` → sukces.
- [ ] **Step 5:** Ustaw `<html lang="pl">` i tytuł aplikacji „Rhytm”. Commit `chore: scaffold next.js + coss ui + vitest`.

### Task 2: Baza danych i RLS

**Files:**
- Create: `supabase/config.toml` (przez `npx supabase init`), `supabase/migrations/0001_init.sql`, `supabase/tests/rls.test.sql`, `src/lib/db/types.ts` (wygenerowane)

**Interfaces:**
- Produces (tabele):
  - `profiles(user_id text pk default (auth.jwt()->>'sub'), weight_kg numeric null, height_cm numeric null, birth_date date null, sex text null check in ('M','K'), timezone text not null default 'Europe/Warsaw')`. Wiersz zakłada aplikacja przy pierwszym wejściu (`ensureProfile`, Task 4).
  - `blocks(id uuid pk default gen_random_uuid(), user_id text not null default (auth.jwt()->>'sub'), title text not null check (length(trim(title)) > 0), color text not null default 'blue', note text null, start_local timestamp not null, duration_min int not null check (duration_min between 5 and 1440), timezone text not null, recurrence jsonb null, created_at timestamptz default now())`
  - `block_exceptions(block_id uuid → blocks on delete cascade, occurrence_date date, cancelled bool not null default false, start_local timestamp null, duration_min int null, title text null, color text null, note text null, primary key(block_id, occurrence_date))`
  - `block_tasks(id uuid pk, block_id uuid → blocks on delete cascade, occurrence_date date not null, title text not null, done bool not null default false, position int not null default 0)`, indeks `(block_id, occurrence_date)`
  - `src/lib/db/types.ts` z `npx supabase gen types typescript --local`.

- [ ] **Step 1: Napisz test pgTAP** `rls.test.sql`: symuluje dwóch użytkowników Clerka przez `set local role authenticated` i `set local request.jwt.claims = '{"sub":"user_a","role":"authenticated"}'` (oraz `user_b`). A wstawia blok + wyjątek + zadanie. Jako B: `select count(*)` z każdej z trzech tabel = 0, a `update`/`delete` na wierszach A dotyka 0 wierszy. B nie może wstawić zadania do bloku A (`throws_ok` lub 0 wierszy). Jako A widać po 1 wierszu.
- [ ] **Step 2:** `npx supabase start` i `npx supabase test db` → FAIL (brak tabel). Jeśli Docker/obrazy są niedostępne w środowisku, przerwij i zgłoś to (trzeba wtedy podpiąć zdalny projekt Supabase od Mejsona).
- [ ] **Step 3:** Napisz migrację. RLS na `profiles`/`blocks`: `user_id = (select auth.jwt()->>'sub')`. Na `block_exceptions`/`block_tasks`: `exists (select 1 from blocks b where b.id = block_id and b.user_id = (select auth.jwt()->>'sub'))` dla select/insert/update/delete. Wszystkie polityki `to authenticated`.
- [ ] **Step 4:** `npx supabase db reset && npx supabase test db` → PASS.
- [ ] **Step 5:** Wygeneruj typy. Commit `feat(db): schema + RLS for profiles and main calendar`.

### Task 3: Clerk — rejestracja, logowanie, ochrona tras, klient Supabase

**Files:**
- Create: `src/proxy.ts` (Next.js 16 nazywa middleware `proxy.ts`), `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`, `src/lib/clerk/appearance.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `.env.local.example`
- Modify: `src/app/layout.tsx` (`<ClerkProvider>`), `supabase/config.toml` (sekcja Clerk w third-party auth)

**Interfaces:**
- Consumes: tabele z Task 2.
- Produces:
  - `createServerClient(): Promise<SupabaseClient<Database>>`: klient z `accessToken: async () => (await auth()).getToken()` (z `@clerk/nextjs/server`).
  - `useSupabase(): SupabaseClient<Database>`: hook kliencki z `accessToken: async () => session?.getToken() ?? null` (z `useSession()`).
  - Middleware `clerkMiddleware` chroni wszystko poza `/sign-in(.*)`, `/sign-up(.*)`, `/manifest.webmanifest`, `/icons/(.*)` i plikami statycznymi (`createRouteMatcher` + `auth.protect()`).
  - `clerkAppearance` (`src/lib/clerk/appearance.ts`): zmienne Clerka z tokenów Rhytm (`colorPrimary: '#191816'`, `colorBackground: '#FFFFFF'`, `colorText: '#191816'`, `colorTextSecondary: '#73716F'`, `colorInputBorder: '#D5D4D1'`, `borderRadius: '0.625rem'`, `fontFamily: 'Inter, sans-serif'`), lokalizacja `plPL` z `@clerk/localizations`.

- [ ] **Step 1:** Uruchom `npx -y clerk@latest init` (instaluje `@clerk/nextjs`, tworzy aplikację Clerka i sam zapisuje klucze do `.env.local`; bez konta powstaje aplikacja do późniejszego przejęcia przez Mejsona). Tylko gdy `init` zawiedzie: instalacja ręczna i klucze od Mejsona. Doinstaluj `@clerk/localizations`. Do `.env.local.example` dopisz `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`, `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/kalendarz`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/kalendarz`.
- [ ] **Step 2:** `<ClerkProvider localization={plPL} appearance={clerkAppearance}>` w `layout.tsx`. Strony `/sign-in` i `/sign-up` z `<SignIn/>` / `<SignUp/>` w układzie z projektu („Logowanie”: formularz po lewej, ciemny panel z heatmapą po prawej). Rejestracja **otwarta**.
- [ ] **Step 3:** `src/proxy.ts` z `clerkMiddleware` według oficjalnego przykładu dla App Router (Next.js 16).
- [ ] **Step 4:** Supabase ↔ Clerk: w `supabase/config.toml` włącz Clerka jako third-party auth (`[auth.third_party.clerk] enabled = true`, `domain` = domena instancji Clerka z env). Klienci Supabase przekazują token sesji Clerka (`accessToken`), bez `@supabase/ssr` i bez sesji Supabase Auth.
- [ ] **Step 5:** Weryfikacja: `npm run dev`; `/` przekierowuje na `/sign-in`; rejestracja nowego konta wpuszcza na `/kalendarz`; zapytanie `select` do `blocks` z `createServerClient()` zwraca `[]` bez błędu (token przyjęty przez Supabase). Commit `feat(auth): clerk sign-in/up, route protection, supabase third-party auth`.

### Task 4: Szkielet aplikacji, profil, PWA

**Files:**
- Create: `src/app/(app)/layout.tsx`, `src/components/nav/AppNav.tsx`, `src/app/(app)/kalendarz/page.tsx` (tymczasowo pusta), `src/app/(app)/sport/page.tsx`, `src/app/(app)/nawyki/page.tsx` (obie: „Wkrótce”), `src/app/(app)/ustawienia/page.tsx`, `src/app/(app)/ustawienia/actions.ts`, `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `src/app/page.tsx` (redirect → `/kalendarz`)

**Interfaces:**
- Produces: `ensureProfile(): Promise<Profile>` w `src/app/(app)/layout.tsx` (upsert wiersza `profiles` dla bieżącego użytkownika przy pierwszym wejściu), `getProfile(): Promise<Profile>` w `src/app/(app)/ustawienia/actions.ts` (używane przez kalendarz do strefy czasowej), `updateProfile(formData)`.

- [ ] **Step 1:** `AppNav`: zakładki Kalendarz / Sport / Nawyki + Ustawienia + `<UserButton/>` Clerka (konto, wylogowanie). Od `md` w górę pasek boczny, poniżej dolny pasek (`useMediaQuery` z coss lub klasy Tailwind).
- [ ] **Step 2:** Ustawienia: zakładka „Konto” to `<UserProfile/>` Clerka; zakładka „Profil”: waga (kg, 30–300), wzrost (cm, 100–250), data urodzenia, płeć (M/K), strefa czasowa (select z `Intl.supportedValuesOf('timeZone')`, domyślnie Europe/Warsaw). Walidacja zakresów po stronie serwera.
- [ ] **Step 3:** `manifest.ts`: `name: "Rhytm"`, `display: "standalone"`, `start_url: "/kalendarz"`, ikony 192/512, `lang: "pl"`.
- [ ] **Step 4:** Weryfikacja: `npm run build` przechodzi. W przeglądarce (widok mobilny w devtools) dolny pasek działa, a zapis profilu przetrwa odświeżenie strony.
- [ ] **Step 5:** Commit `feat(app): shell navigation, profile settings, PWA manifest`.

### Task 5: Rozwijanie powtórzeń (czysta logika)

**Files:**
- Create: `src/lib/calendar/types.ts`, `src/lib/calendar/expand.ts`, `src/lib/calendar/expand.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = poniedziałek (ISO)
  export type Recurrence =
    | { freq: 'daily'; until?: string }                         // 'YYYY-MM-DD', włącznie
    | { freq: 'weekdays'; until?: string }                      // pn–pt
    | { freq: 'weekly'; until?: string }                        // ten sam dzień tygodnia co start
    | { freq: 'custom'; byWeekday: Weekday[]; until?: string }; // wybrane dni
  export type BlockSeries = { id: string; title: string; color: string; note: string | null;
    startLocal: string; /* 'YYYY-MM-DDTHH:mm' */ durationMin: number; timezone: string; recurrence: Recurrence | null };
  export type BlockException = { blockId: string; occurrenceDate: string; cancelled: boolean;
    startLocal?: string; durationMin?: number; title?: string; color?: string; note?: string | null };
  export type Occurrence = { blockId: string; occurrenceDate: string; start: Date; end: Date;
    title: string; color: string; note: string | null; recurring: boolean };
  ```
- Produces (`expand.ts`): `expandOccurrences(series: BlockSeries, exceptions: BlockException[], from: string, to: string): Occurrence[]`. `from`/`to` to lokalne daty `YYYY-MM-DD` włącznie. Zwraca wystąpienia, których **czas trwania nachodzi** na zakres, posortowane po `start`. Konwersja czasu lokalnego na `Date` przez `fromZonedTime(local, series.timezone)`.

- [ ] **Step 1: Napisz testy** w `expand.test.ts`:
  - `pojedynczy blok`: bez `recurrence` → 1 wystąpienie, `occurrenceDate` = data ze `startLocal`.
  - `daily`: start `2026-11-16T08:00`, zakres 16–22.11 → 7 wystąpień, każde 08:00 lokalnie.
  - `weekdays`: ten sam zakres → 5 wystąpień (16–20.11).
  - `custom [1,3,5]` → daty 16, 18, 20.11.
  - `weekly` startujący w środę → tylko środy.
  - `until` = 18.11 → ostatnie wystąpienie 18.11.
  - zakres przed startem serii → `[]`.
  - **DST:** `daily 08:00 Europe/Warsaw`, zakres 28–31.03.2026 → `start.toISOString()` = `…T07:00:00.000Z` dla 28.03 oraz `…T06:00:00.000Z` dla 30.03. Analogicznie 24–27.10.2026 (06:00Z → 07:00Z).
  - **Przez północ:** start `2026-11-16T23:00`, `durationMin: 120`, zakres tylko 17.11 → 1 wystąpienie z `occurrenceDate '2026-11-16'`.
  - **Wyjątek cancelled** usuwa wystąpienie. **Wyjątek zmodyfikowany** (`startLocal: '2026-11-19T10:00'` dla `occurrenceDate '2026-11-18'`) → wystąpienie z `occurrenceDate '2026-11-18'` i startem 19.11 10:00. Pojawia się, gdy zakres obejmuje 19.11, nawet jeśli nie obejmuje 18.11.
- [ ] **Step 2:** `npx vitest run src/lib/calendar/expand.test.ts` → FAIL.
- [ ] **Step 3:** Zaimplementuj `expandOccurrences`: przejście dzień po dniu od `max(startDate, from − 1 dzień)` do `min(until, to)`, test dopasowania dnia tygodnia, nałożenie wyjątków. Wyjątki przesunięte poza pętlę trzeba dołożyć osobno (pętla po kandydackich datach nie wystarcza: zmodyfikowane wystąpienie może wejść w zakres z daty spoza niego).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(calendar): recurrence expansion with DST-safe local time`.

### Task 6: Planowanie edycji i usuwania (czysta logika)

**Files:**
- Create: `src/lib/calendar/plan-edit.ts`, `src/lib/calendar/plan-edit.test.ts`

**Interfaces:**
- Consumes: typy z Task 5, `expandOccurrences`.
- Produces:
  ```ts
  export type Scope = 'this' | 'following' | 'all';
  export type BlockChange = Partial<Pick<BlockSeries, 'title' | 'color' | 'note' | 'durationMin' | 'recurrence'>> & { startLocal?: string };
  export type Mutation =
    | { kind: 'upsertException'; exception: BlockException }
    | { kind: 'updateSeries'; id: string; patch: Partial<Omit<BlockSeries, 'id'>> }
    | { kind: 'insertSeries'; tempId: string; series: Omit<BlockSeries, 'id'> }
    | { kind: 'moveChildren'; fromId: string; toTempId: string; fromDate: string } // wyjątki + zadania z occurrence_date >= fromDate
    | { kind: 'deleteChildrenFrom'; id: string; fromDate: string }
    | { kind: 'deleteTasksOn'; blockId: string; dates: string[] }
    | { kind: 'deleteSeries'; id: string };
  export function planEdit(series: BlockSeries, occurrenceDate: string, scope: Scope, change: BlockChange, taskDates: string[]): { mutations: Mutation[]; droppedTaskDates: string[] };
  export function planDelete(series: BlockSeries, occurrenceDate: string, scope: Scope): Mutation[];
  ```
  `taskDates` to daty wystąpień tej serii, które mają zadania. `droppedTaskDates` to te z nich, których nowy harmonogram już nie generuje. Te zadania zostaną usunięte, a UI ostrzega przed tym w Task 8.

- [ ] **Step 1: Napisz testy:**
  - `this` → jedna mutacja `upsertException` z `occurrenceDate` = oryginalna data, nawet gdy `change.startLocal` jest innego dnia (**Review Focus 4**), `droppedTaskDates: []`.
  - `all`, zmiana tylko godziny (08:00→09:00) → `updateSeries` ze `startLocal` = oryginalna data startu serii + 09:00, `droppedTaskDates: []`.
  - `all`, zmiana `recurrence` daily→weekdays przy `taskDates ['2026-11-21','2026-11-18']` → `droppedTaskDates ['2026-11-21']` i mutacja `deleteTasksOn` dla tej daty.
  - `following` od 18.11 dla serii od 16.11 → kolejno: `insertSeries` (start 18.11, ta sama reguła, `until` oryginału), `moveChildren(fromDate '2026-11-18')`, `updateSeries` oryginału z `recurrence.until = '2026-11-17'`.
  - `following` na **pierwszym** wystąpieniu → wynik identyczny jak `all` (**Review Focus 3**).
  - `planDelete`: `this` → wyjątek `cancelled: true` + `deleteTasksOn([date])`. `following` → `updateSeries(until = dzień przed)` + `deleteChildrenFrom`. `all` lub blok niecykliczny → `deleteSeries`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Zaimplementuj. Kolejność mutacji w `following` jest celowa: najpierw powstaje nowa seria i przenoszone są dzieci, dopiero na końcu skracany jest oryginał. Przerwanie w połowie nie gubi wtedy zadań.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(calendar): edit/delete scope planning`.

### Task 7: Warstwa danych kalendarza

**Files:**
- Create: `src/app/(app)/kalendarz/actions.ts`, `src/lib/calendar/mapping.ts`, `src/lib/calendar/mapping.test.ts`

**Interfaces:**
- Consumes: `createServerClient`, `planEdit`, `planDelete`, `expandOccurrences`, typy DB.
- Produces (server actions):
  - `listOccurrences(from: string, to: string): Promise<(Occurrence & { taskDone: number; taskTotal: number })[]>`
  - `createBlock(input: Omit<BlockSeries, 'id' | 'timezone'>): Promise<string>`: strefa czasowa z profilu.
  - `previewEdit(blockId, occurrenceDate, scope, change): Promise<{ droppedTaskDates: string[] }>`
  - `editBlock(blockId, occurrenceDate, scope, change): Promise<void>`
  - `deleteBlock(blockId, occurrenceDate, scope): Promise<void>`
  - `listTasks(blockId, occurrenceDate)`, `addTask(blockId, occurrenceDate, title)`, `toggleTask(id, done)`, `renameTask(id, title)`, `deleteTask(id)`.
- `mapping.ts`: `rowToSeries(row): BlockSeries` i `seriesToRow(series)`: konwersja kolumn snake_case ↔ typów.

- [ ] **Step 1:** Testy `mapping.test.ts`: round-trip `seriesToRow(rowToSeries(row))` zachowuje wszystkie pola, w tym `recurrence: null` i `custom` z `byWeekday`.
- [ ] **Step 2:** Run → FAIL. Implementuj mapowanie. Run → PASS.
- [ ] **Step 3:** Zaimplementuj akcje. `editBlock`/`deleteBlock` wykonują mutacje po kolei jedną pętlą `switch (m.kind)` (bez osobnego helpera na każdy rodzaj). `tempId` zamieniany jest na prawdziwe id po `insertSeries`. Każda akcja waliduje wejście (pusty tytuł, `durationMin` 5–1440, `until` ≥ data startu) i rzuca błąd z polskim komunikatem.
- [ ] **Step 4:** Weryfikacja: `npm run build` i `npm test` przechodzą.
- [ ] **Step 5:** Commit `feat(calendar): server actions for blocks and tasks`.

### Task 8: Widok kalendarza

**Files:**
- Create: `src/components/calendar/MainCalendar.tsx`, `src/components/calendar/BlockForm.tsx`, `src/components/calendar/ScopeDialog.tsx`, `src/components/calendar/calendar.css`
- Modify: `src/app/(app)/kalendarz/page.tsx`

**Interfaces:**
- Consumes: akcje z Task 7.
- Produces: `<MainCalendar timezone={string} />` (client component). `<ScopeDialog open recurring onPick={(scope) => …} droppedTaskCount={number} />`.

- [ ] **Step 1:** `MainCalendar`: FullCalendar z widokami `timeGridWeek` (domyślny ≥ md), `timeGridDay` (domyślny < md), `dayGridMonth`. `locale: 'pl'`, `firstDay: 1`, `timeZone` z profilu, format 24h. Zdarzenia pobierane przez `listOccurrences` dla widocznego zakresu (callback `events`). Tytuł zdarzenia z licznikiem zadań „Nauka · 1/2”, gdy `taskTotal > 0`.
- [ ] **Step 2:** Interakcje: `selectable` (przeciągnięcie tworzy blok → `BlockForm`), `editable` (przesuwanie i zmiana długości → dla bloku cyklicznego `ScopeDialog`, potem `editBlock`). Na mobile przycisk „+” otwiera `BlockForm` z najbliższą pełną godziną.
- [ ] **Step 3:** `BlockForm` (coss `Dialog`/`Sheet` na mobile): tytuł, kolor (6 stałych: blue, green, orange, red, purple, gray), notatka, powtarzanie (Nie / Codziennie / Dni robocze / Co tydzień / Wybrane dni + przełączniki Pn–Nd) i opcjonalna data końca.
- [ ] **Step 4:** `ScopeDialog`: „Tylko to wydarzenie / To i następne / Wszystkie”. Przed zapisem wywołuje `previewEdit`. Gdy `droppedTaskCount > 0`, pokazuje ostrzeżenie: „Zadania w {n} wystąpieniach, które znikną, zostaną usunięte”. Przy usuwaniu bloku też pyta o zakres.
- [ ] **Step 5:** `calendar.css` dopasowuje FullCalendar do tokenów coss (`--background`, `--border`, `--foreground`, `--muted`, font `--font-sans`).
- [ ] **Step 6:** Weryfikacja ręczna (dev, zalogowany): utwórz blok przeciągnięciem, ustaw „Dni robocze”, przesuń środowe wystąpienie z opcją „tylko to”, zmień godzinę „wszystkich”. Po odświeżeniu stan jest zgodny.
- [ ] **Step 7:** Commit `feat(calendar): main calendar UI with drag, recurrence and scope dialog`.

### Task 9: Panel bloku z zadaniami + test end-to-end

**Files:**
- Create: `src/components/calendar/BlockPanel.tsx`, `e2e/calendar.spec.ts`, `playwright.config.ts`
- Modify: `src/components/calendar/MainCalendar.tsx` (klik w zdarzenie otwiera panel)

**Interfaces:**
- Consumes: `listTasks`, `addTask`, `toggleTask`, `renameTask`, `deleteTask`, `editBlock`, `deleteBlock`.
- Produces: `<BlockPanel blockId occurrenceDate onChanged={() => void} />`.

- [ ] **Step 1: Napisz test e2e** `calendar.spec.ts` (Playwright, lokalny Supabase, logowanie testowym użytkownikiem Clerka przez `@clerk/testing/playwright` — `clerkSetup()` + `clerk.signIn()`; dane konta testowego w `E2E_CLERK_USER_EMAIL` / `E2E_CLERK_USER_PASSWORD`):
  - loguje się, tworzy blok „Nauka matma” z powtarzaniem „Dni robocze”, otwiera wystąpienie z poniedziałku, dodaje zadania „A” i „B”, odhacza „A”. Zdarzenie pokazuje „1/2”.
  - otwiera wystąpienie z wtorku: lista zadań jest pusta.
  - przeładowuje stronę: poniedziałek dalej pokazuje „1/2”.
- [ ] **Step 2:** `npm run test:e2e` → FAIL.
- [ ] **Step 3:** `BlockPanel` (coss `Sheet` z prawej, na mobile od dołu): nagłówek z tytułem, datą i godzinami (edycja przez `BlockForm` + `ScopeDialog`), lista zadań z checkboxami, pole „+ dodaj zadanie” (Enter dodaje), edycja tytułu zadania po kliknięciu, usuwanie, licznik „zrobione/wszystkie”, przycisk „Usuń blok”. Po każdej zmianie `onChanged()` odświeża kalendarz.
- [ ] **Step 4:** `npm run test:e2e` → PASS. `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(calendar): block panel with per-occurrence tasks + e2e test`.

---

## Po etapie (dla Mejsona, poza kodem)
- **Clerk:** założyć aplikację w panelu Clerka, włączyć logowanie e-mail + hasło oraz Google, podać klucze (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`). Utworzyć konto testowe do testów e2e.
- **Supabase:** założyć projekt (darmowy), w *Authentication → Third-Party Auth* dodać Clerka. Podać `NEXT_PUBLIC_SUPABASE_URL` i klucz publiczny.
- **Vercel:** podpiąć repozytorium i ustawić te same zmienne środowiskowe.
