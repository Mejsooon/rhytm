# Etap 2: nawyki, sen i ekran Dziś — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Działają nawyki (harmonogramy, odhaczanie, heatmapa z zakresami, szczegóły nawyku, archiwizacja), dziennik snu (wpis, wykres z zakresami i celem) i ekran startowy „Dziś” (plan dnia, nawyki, sen) według ekranów z płótna.

**Architecture:** Nowe tabele w migracji `0003` (RLS jak dotąd). Cała logika liczenia (harmonogram w danym dniu, % dnia, serie, siatka heatmapy, czas snu przez północ, słupki snu) to czyste funkcje w `src/lib/habits/` i `src/lib/sleep/`, pokryte testami. Odczyty dla stron idą przez funkcje serwerowe wołane w komponentach serwerowych (w `Suspense`), zapisy przez Server Actions. Harmonogram nawyku jest wersjonowany (tabela `habit_schedules`), więc zmiana nie przelicza przeszłych dni.

**Tech Stack:** bez zmian (Next.js 16 z `cacheComponents`, Clerk, Supabase, coss ui, date-fns + date-fns-tz, Vitest, Playwright, testy SQL). Nowych zależności nie dodajemy (wykresy i heatmapy jako własne komponenty z `div`).

**Spec:** `docs/superpowers/specs/2026-11-13-life-organizer-design.md` (wersja 2): 4.3, 4.4, 4.5 (cel snu w profilu), 4.6, 5, 5a. Wzór wyglądu: płótno „Rhytm — ekrany aplikacji”, lokalne kopie `/home/claude/rhytm-screens/project/QuietHabits.dc.html`, `QuietHabitDialog.dc.html`, `QuietToday.dc.html`.

**Poza tym planem:** przypomnienia push (osobny plan „Etap 2b”, bo to oddzielny podsystem: service worker, klucze VAPID, wysyłka z harmonogramu), szybkie dodawanie i wniosek tygodnia (etap 4), część sportowa ekranu Dziś (etap 3).

## Global Constraints

- Interfejs po polsku, tydzień od poniedziałku, format 24h. „Dzień” (nawyki, sen, heatmapy, dziś) liczony w strefie z profilu.
- Klucze tylko w `.env.local`; nigdy `service_role`. Każda nowa tabela ma RLS „tylko własne wiersze” po `auth.jwt()->>'sub'`.
- Harmonogramy: `daily` (codziennie), `days` (wybrane dni tygodnia, ISO 1 = pn … 7 = nd), `weekly` (X razy w tygodniu, X 1–7, dowolne dni), `none` (bez planu).
- % dnia = (zrobione zaplanowane na ten dzień + odhaczone `weekly` i `none`) / (zaplanowane na ten dzień + odhaczone `weekly` i `none`). Dzień bez żadnego zaplanowanego ani odhaczonego nawyku = `null` (pusty, szary), nie 0%.
- Zmiana harmonogramu działa od dnia zmiany (nowa wersja `valid_from` = dziś); przeszłe dni liczą się według wersji obowiązującej wtedy.
- Seria: `daily`/`days` w dniach (liczą się tylko zaplanowane dni), `weekly` w tygodniach (tydzień zaliczony, gdy odhaczeń ≥ X), `none` bez serii. Dzisiejszy niezrobiony dzień (albo bieżący tydzień) nie przerywa serii.
- Heatmapa nawyków: zakresy `month` (kalendarz bieżącego miesiąca), `quarter` (13 tygodni), `half` (26), `year` (53), domyślnie `half`. Kolory: pusty `#F4F4F3`, 0% `#E6E6E4`, 1–39% `#D9EEDF`, 40–69% `#AEDABB`, 70–99% `#73BD8C`, 100% `#3E9B63`. Dziś z obwódką `#191816`, dni przyszłe bez koloru.
- Sen: wpis na dzień pobudki; zaśnięcie i pobudka jako `HH:mm`; czas snu 30 min – 16 h, liczony przez północ i ze zmianą czasu (strefa z profilu); samopoczucie 1–5; notatka do 500 znaków. Cel snu w profilu `sleep_goal_min`, domyślnie 480, zakres 240–720, krok 15 min.
- Wykres snu: zakresy jak heatmapa; `month` = 30 nocy (słupek = noc), `quarter`/`half` = średnia tygodnia, `year` = średnia miesiąca (12). Kolory: słupek `#E7E4F6`, cel osiągnięty `#CFC8F0`, najnowszy `#7C6BD6`, linia celu przerywana `#CFC8F0`.
- Szerokość treści: `/nawyki` max 880 px, `/dzis` max 1200 px, wyśrodkowane.

## Review Focus

1. Nawyk „3× w tygodniu” nieodhaczony dziś nie obniża % dnia (nie trafia do mianownika). Test: Task 2.
2. Zmiana harmonogramu w środku historii nie zmienia % przeszłych dni ani serii sprzed zmiany. Test: Task 2.
3. Noc 24→25 października 2026 (zmiana czasu w Europie): zaśnięcie 23:00, pobudka 07:00 to 9 h, a nie 8. Noc 00:30→07:00 to 6 h 30 min. Test: Task 4.
4. Odhaczenie nawyku w przyszłości, przed jego utworzeniem albo po archiwizacji jest odrzucane czytelnym błędem. Test: Task 5 (`assertCheckable`).
5. Tuż po północy w Warszawie (23:30 UTC) „dziś” to już nowa data z profilu, a nie data UTC. Test: Task 2 (`todayIn`).

---

### Task 1: Migracja `0003` — nawyki, sen, cel snu

**Files:**
- Create: `supabase/migrations/0003_habits_sleep.sql`, `supabase/tests/habits_sleep.test.sql`
- Modify: `scripts/test-db.sh` (dopisz nowy test na końcu), `src/lib/db/types.ts`

**Interfaces:**
- Produces (SQL):
  - `habits (id uuid pk default gen_random_uuid(), user_id text not null default (auth.jwt()->>'sub'), name text not null check (length(trim(name)) between 1 and 60), position int not null default 0, archived_at date null, created_at timestamptz default now())`.
  - `habit_schedules (habit_id uuid not null references habits(id) on delete cascade, valid_from date not null, schedule_type text not null check (schedule_type in ('daily','days','weekly','none')), weekdays int[] null, times_per_week int null check (times_per_week between 1 and 7), primary key (habit_id, valid_from))` + check: `days` wymaga niepustych `weekdays` z wartościami 1–7, `weekly` wymaga `times_per_week`.
  - `habit_checks (habit_id uuid not null references habits(id) on delete cascade, date date not null, primary key (habit_id, date))`.
  - `sleep_logs (user_id text not null default (auth.jwt()->>'sub'), date date not null, slept_at time not null, woke_at time not null, feeling int not null check (feeling between 1 and 5), note text null check (note is null or length(note) <= 500), primary key (user_id, date))`.
  - `alter table profiles add column sleep_goal_min int not null default 480 check (sleep_goal_min between 240 and 720)`.
  - RLS: `habits_own`, `sleep_logs_own` jak `blocks_own`; `habit_schedules_own` i `habit_checks_own` przez `exists (select 1 from habits h where h.id = habit_id and h.user_id = sub)` w `using` i `with check`. Granty dla `authenticated`.

- [ ] **Step 1:** `habits_sleep.test.sql` (styl jak `rls.test.sql`, bloki `DO` z `FAIL:`): użytkownik A tworzy nawyk, wersję harmonogramu i odhaczenie; B nie widzi nawyku, wersji, odhaczenia ani wpisu snu A; B nie może dodać odhaczenia do nawyku A (`insufficient_privilege`); drugie odhaczenie tego samego dnia → `unique_violation`; `days` bez `weekdays` → `check_violation`; `feeling = 6` → `check_violation`; profil ma `sleep_goal_min = 480`. Na końcu `raise notice 'HABITS_SLEEP OK'`.
- [ ] **Step 2:** Dopisz test do `scripts/test-db.sh`; `npm run test:db` → FAIL (brak tabel).
- [ ] **Step 3:** Napisz migrację (jedna transakcja; bez tabel tymczasowych). Zaktualizuj ręcznie `src/lib/db/types.ts`.
- [ ] **Step 4:** `npm run test:db` → `RLS OK`, `CATEGORIES OK`, `HABITS_SLEEP OK`; `npm run build` → OK.
- [ ] **Step 5:** `git commit -m "feat(db): nawyki z wersjonowanym harmonogramem, odhaczenia, dziennik snu"`

### Task 2: Logika nawyków — harmonogram, % dnia, serie, „dziś”

**Files:**
- Create: `src/lib/habits/types.ts`, `src/lib/habits/schedule.ts`, `src/lib/habits/schedule.test.ts`, `src/lib/dates.ts`, `src/lib/dates.test.ts`

**Interfaces:**
- Produces:
  - `type ScheduleType = 'daily' | 'days' | 'weekly' | 'none'`.
  - `type HabitSchedule = { validFrom: string; type: ScheduleType; weekdays: number[]; timesPerWeek: number | null }`.
  - `type HabitHistory = { id: string; name: string; createdOn: string; archivedOn: string | null; schedules: HabitSchedule[]; checks: ReadonlySet<string> }` (daty `YYYY-MM-DD`).
  - `todayIn(timezone: string, now: Date): string` w `dates.ts`.
  - `scheduleOn(habit: HabitHistory, date: string): HabitSchedule | null` — wersja z największym `validFrom ≤ date`; `null`, gdy data przed `createdOn` albo w dniu archiwizacji lub później.
  - `isPlannedOn(schedule: HabitSchedule, date: string): boolean` — `daily` zawsze, `days` gdy dzień tygodnia ISO w `weekdays`, `weekly`/`none` nigdy.
  - `dayScore(habits: HabitHistory[], date: string): { done: number; total: number; pct: number | null }` według wzoru z Global Constraints (`pct` zaokrąglone do całości).
  - `habitStreak(habit: HabitHistory, today: string): { value: number; unit: 'days' | 'weeks' } | null`.
  - `weekProgress(habit: HabitHistory, date: string): { done: number; target: number } | null` (tylko `weekly`; tydzień pn–nd zawierający `date`).
  - `scheduleLabel(schedule: HabitSchedule): string` — „codziennie”, „pon–pt” (gdy dokładnie 1–5), „pn, śr, pt”, „3× w tygodniu”, „bez planu”.

- [ ] **Step 1: Testy** (fragmenty — implementer dopisuje dane pomocnicze `habit({...})`):

```ts
expect(todayIn('Europe/Warsaw', new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
expect(todayIn('Europe/Warsaw', new Date('2026-11-18T12:00:00Z'))).toBe('2026-11-18');

const water = habit({ createdOn: '2026-11-01', schedules: [{ validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null }], checks: ['2026-11-16'] });
const stretch = habit({ createdOn: '2026-11-01', schedules: [{ validFrom: '2026-11-01', type: 'weekly', weekdays: [], timesPerWeek: 3 }], checks: [] });
expect(dayScore([water, stretch], '2026-11-16')).toEqual({ done: 1, total: 1, pct: 100 }); // weekly nieodhaczony nie liczy się
expect(dayScore([water, stretch], '2026-11-17')).toEqual({ done: 0, total: 1, pct: 0 });
expect(dayScore([habit({ createdOn: '2026-11-01', schedules: [{ validFrom: '2026-11-01', type: 'none', weekdays: [], timesPerWeek: null }], checks: [] })], '2026-11-17').pct).toBeNull();
expect(dayScore([water], '2026-10-31').pct).toBeNull(); // przed utworzeniem

// wersjonowanie: do 15 lis codziennie, od 16 lis tylko pn–pt
const study = habit({ createdOn: '2026-11-01', schedules: [
  { validFrom: '2026-11-01', type: 'daily', weekdays: [], timesPerWeek: null },
  { validFrom: '2026-11-16', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null }], checks: [] });
expect(isPlannedOn(scheduleOn(study, '2026-11-15')!, '2026-11-15')).toBe(true);   // niedziela, stara wersja
expect(isPlannedOn(scheduleOn(study, '2026-11-22')!, '2026-11-22')).toBe(false);  // niedziela, nowa wersja

// seria w dniach: zrobione 16, 17; dziś 18 niezrobione nie przerywa
expect(habitStreak(habit({ createdOn: '2026-11-01', schedules: [daily], checks: ['2026-11-16', '2026-11-17'] }), '2026-11-18')).toEqual({ value: 2, unit: 'days' });
// days pn/śr/pt: zrobione pt 13, pn 16 → 2 (wt/czw/so/nd pomijane)
// weekly 3×: tydzień 2–8 lis 3 odhaczenia, 9–15 lis 3, bieżący 16–22 lis 1 → { value: 2, unit: 'weeks' }
expect(weekProgress(stretchWithChecks(['2026-11-16']), '2026-11-18')).toEqual({ done: 1, target: 3 });
expect(scheduleLabel({ validFrom: 'x', type: 'days', weekdays: [1, 2, 3, 4, 5], timesPerWeek: null })).toBe('pon–pt');
expect(scheduleLabel({ validFrom: 'x', type: 'weekly', weekdays: [], timesPerWeek: 3 })).toBe('3× w tygodniu');
```

- [ ] **Step 2:** `npx vitest run src/lib/habits src/lib/dates.test.ts` → FAIL.
- [ ] **Step 3:** Zaimplementuj (date-fns: `parseISO`, `getISODay`, `startOfISOWeek`, `addDays`; `formatInTimeZone` dla `todayIn`). Seria w dniach cofa się dzień po dniu od `today` (dziś pomijane, jeśli niezrobione) do pierwszego zaplanowanego niezrobionego dnia; seria w tygodniach analogicznie po tygodniach.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -m "feat(habits): harmonogram z wersjami, % dnia i serie"`

### Task 3: Logika heatmapy nawyków

**Files:**
- Create: `src/lib/habits/heatmap.ts`, `src/lib/habits/heatmap.test.ts`

**Interfaces:**
- Consumes: `dayScore`, `HabitHistory` (Task 2).
- Produces:
  - `type HeatRange = 'month' | 'quarter' | 'half' | 'year'`.
  - `heatmapDays(range: Exclude<HeatRange, 'month'>, today: string): { weeks: string[][]; monthLabels: { col: number; label: string }[] }` — kolumny = tygodnie pn–nd, ostatnia kolumna zawiera `today`, liczba kolumn 13/26/53; etykiety miesięcy („sty”…„gru”) w kolumnie, w której zaczyna się miesiąc.
  - `monthCalendarDays(today: string): { date: string; inMonth: boolean }[]` — 6×7 od poniedziałku tygodnia z 1. dniem miesiąca.
  - `heatLevel(pct: number | null): 'empty' | 'zero' | 1 | 2 | 3 | 4` (progi z Global Constraints).
  - `heatStats(habits: HabitHistory[], from: string, to: string): { avgPct: number | null; bestRun: number }` — średnia z dni z wynikiem ≠ `null`; `bestRun` = najdłuższy ciąg kolejnych dni z `pct === 100`.

- [ ] **Step 1: Testy**

```ts
const q = heatmapDays('quarter', '2026-11-18');
expect(q.weeks).toHaveLength(13);
expect(q.weeks[12][0]).toBe('2026-11-16');
expect(q.weeks[0][0]).toBe('2026-08-24');
expect(heatmapDays('year', '2026-11-18').weeks).toHaveLength(53);
expect(q.monthLabels[0]).toEqual({ col: 0, label: 'sie' });
expect(monthCalendarDays('2026-11-18')[0]).toEqual({ date: '2026-10-26', inMonth: false });
expect(heatLevel(null)).toBe('empty'); expect(heatLevel(0)).toBe('zero'); expect(heatLevel(39)).toBe(1);
expect(heatLevel(40)).toBe(2); expect(heatLevel(99)).toBe(3); expect(heatLevel(100)).toBe(4);
// heatStats: 3 dni po 100%, potem 50%, potem 100% → bestRun 3, avgPct 90
```

- [ ] **Step 2–4:** FAIL → implementacja → `npm test` PASS.
- [ ] **Step 5:** `git commit -m "feat(habits): siatka heatmapy, poziomy kolorów i statystyki zakresu"`

### Task 4: Logika snu

**Files:**
- Create: `src/lib/sleep/sleep.ts`, `src/lib/sleep/sleep.test.ts`

**Interfaces:**
- Consumes: `HeatRange` (Task 3).
- Produces:
  - `type SleepLog = { date: string; sleptAt: string; wokeAt: string; feeling: number; note: string | null }`.
  - `sleepMinutes(date: string, sleptAt: string, wokeAt: string, timezone: string): number` — gdy `sleptAt > wokeAt` (albo równe), zaśnięcie było dzień wcześniej; różnica liczona na prawdziwych chwilach (`fromZonedTime`), więc zmiana czasu się liczy.
  - `validateSleepInput(input: { date: string; sleptAt: string; wokeAt: string; feeling: number; note: string }, timezone: string, today: string): SleepLog` — błędy: `'Nieprawidłowa godzina'`, `'Sen musi trwać od 30 minut do 16 godzin'`, `'Samopoczucie musi być od 1 do 5'`, `'Notatka może mieć najwyżej 500 znaków'`, `'Nie można zapisać snu z przyszłości'`; pusta notatka → `null`.
  - `formatMinutes(min: number): string` — „7 h 30”, „8 h”, „45 min”.
  - `sleepBars(logs: SleepLog[], range: HeatRange, today: string, timezone: string, goalMin: number): { key: string; label: string; title: string; minutes: number | null; metGoal: boolean; latest: boolean }[]`.
  - `sleepStats(logs: SleepLog[], from: string, to: string, timezone: string): { avgMinutes: number | null; avgBedtime: string | null; avgFeeling: number | null }` — średnia godzina zaśnięcia z przesunięciem godzin przed 12:00 o +24 h (żeby 23:50 i 00:10 dały 00:00).

- [ ] **Step 1: Testy**

```ts
expect(sleepMinutes('2026-11-18', '23:40', '07:10', 'Europe/Warsaw')).toBe(450);
expect(sleepMinutes('2026-11-18', '00:30', '07:00', 'Europe/Warsaw')).toBe(390);
expect(sleepMinutes('2026-10-25', '23:00', '07:00', 'Europe/Warsaw')).toBe(540); // zmiana czasu
expect(formatMinutes(450)).toBe('7 h 30'); expect(formatMinutes(480)).toBe('8 h'); expect(formatMinutes(45)).toBe('45 min');
expect(() => validateSleepInput({ date: '2026-11-18', sleptAt: '06:50', wokeAt: '07:00', feeling: 3, note: '' }, 'Europe/Warsaw', '2026-11-18')).toThrow('Sen musi trwać od 30 minut do 16 godzin');
expect(() => validateSleepInput({ date: '2026-11-19', sleptAt: '23:00', wokeAt: '07:00', feeling: 3, note: '' }, 'Europe/Warsaw', '2026-11-18')).toThrow('Nie można zapisać snu z przyszłości');
expect(sleepBars([], 'month', '2026-11-18', 'Europe/Warsaw', 480)).toHaveLength(30);
expect(sleepBars([], 'quarter', '2026-11-18', 'Europe/Warsaw', 480)).toHaveLength(13);
expect(sleepBars([], 'year', '2026-11-18', 'Europe/Warsaw', 480)).toHaveLength(12);
// średnia tygodnia z 2 wpisów (420 i 480) = 450; brak wpisów → minutes null; metGoal przy goal 450 → true
expect(sleepStats([log('23:50'), log('00:10')], '2026-11-01', '2026-11-30', 'Europe/Warsaw').avgBedtime).toBe('00:00');
```

- [ ] **Step 2–4:** FAIL → implementacja → `npm test` PASS.
- [ ] **Step 5:** `git commit -m "feat(sleep): czas snu przez północ, walidacja, słupki i statystyki"`

### Task 5: Dane i akcje nawyków

**Files:**
- Create: `src/lib/habits/load.ts`, `src/lib/habits/rules.ts`, `src/lib/habits/rules.test.ts`, `src/app/(app)/nawyki/habit-actions.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `ensureProfile` (strefa).
- Produces:
  - `assertCheckable(habit: HabitHistory, date: string, today: string): void` (czyste, w `rules.ts`) — błędy `'Nie można odhaczyć nawyku w przyszłości'`, `'Ten nawyk jeszcze wtedy nie istniał'`, `'Nawyk jest zarchiwizowany'`.
  - `validateHabitInput(input: { name: string; type: string; weekdays: number[]; timesPerWeek: number | null }): { name: string; schedule: Omit<HabitSchedule, 'validFrom'> }` (czyste) — nazwa 1–60 znaków po przycięciu, `days` wymaga 1–7 unikalnych dni, `weekly` 1–7; komunikaty: `'Nazwa nie może być pusta'`, `'Nazwa może mieć najwyżej 60 znaków'`, `'Wybierz co najmniej jeden dzień'`, `'Liczba razy w tygodniu musi być od 1 do 7'`, `'Nieznany harmonogram'`.
  - `loadHabits(from: string, to: string): Promise<{ timezone: string; today: string; habits: HabitHistory[] }>` (serwer; nawyki aktywne w zakresie, ich wersje i odhaczenia w zakresie poszerzonym o 53 tygodnie wstecz dla serii).
  - Server Actions: `createHabit(input)`, `updateHabit(id, input)` (zmiana harmonogramu = upsert wersji z `valid_from = today`; sama zmiana nazwy nie tworzy wersji), `archiveHabit(id)` (`archived_at = today`), `setHabitCheck(habitId: string, date: string, done: boolean)` (sprawdza `assertCheckable`; `done=false` usuwa wiersz; ponowne odhaczenie istniejącego dnia nie jest błędem).

- [ ] **Step 1: Testy** `rules.test.ts`: `assertCheckable` dla jutra, dnia przed `createdOn`, dnia po archiwizacji (trzy komunikaty) i poprawnego dnia (bez błędu); `validateHabitInput` dla każdego komunikatu i dla poprawnego `days` `[5, 1, 3]` → `weekdays` posortowane `[1, 3, 5]`.
- [ ] **Step 2–4:** FAIL → implementacja (`rules.ts`, potem `load.ts` i akcje według wzoru `src/app/(app)/kalendarz/category-actions.ts`) → `npm test`, `npm run build` PASS.
- [ ] **Step 5:** `git commit -m "feat(habits): akcje nawyków, wersjonowanie harmonogramu, reguły odhaczania"`

### Task 6: Dane i akcje snu + cel snu w ustawieniach

**Files:**
- Create: `src/app/(app)/nawyki/sleep-actions.ts`
- Modify: `src/lib/profile-validation.ts` (+ test), `src/app/(app)/ustawienia/actions.ts`, `src/app/(app)/ustawienia/profile-form.tsx`

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `listSleepLogs(from: string, to: string): Promise<SleepLog[]>`, `saveSleepLog(input)` (walidacja `validateSleepInput`, upsert po `(user_id, date)`), `deleteSleepLog(date: string)`.
  - Profil: pole `sleep_goal_min` w `ProfileInput`/`ProfileValues`; w formularzu jako „Cel snu” w godzinach i minutach (np. pole `7:30`); walidacja 240–720 co 15 min, komunikat `'Cel snu musi wynosić od 4 do 12 godzin (co 15 minut).'`.

- [ ] **Step 1:** Testy w `profile-validation.test.ts`: `'7:30'` → 450, `'8'` → 480, `'3:45'` → błąd, `'7:20'` → błąd, puste → 480.
- [ ] **Step 2–4:** FAIL → implementacja → `npm test`, `npm run build` PASS.
- [ ] **Step 5:** `git commit -m "feat(sleep): zapis snu i cel snu w ustawieniach"`

### Task 7: Ekran Nawyki — lista dnia, okno nawyku, szczegóły nawyku

**Files:**
- Create: `src/components/habits/HabitList.tsx`, `src/components/habits/HabitDialog.tsx`, `src/components/habits/HabitDetail.tsx`, `src/components/habits/DayNav.tsx`
- Modify: `src/app/(app)/nawyki/page.tsx`

**Interfaces:**
- Consumes: Tasks 2, 5.
- Produces: strona `/nawyki?d=YYYY-MM-DD` (brak `d` = dziś; `d` w przyszłości → przekierowanie na dziś). Kolumna 880 px.

- [ ] **Step 1:** Według ekranu `QuietHabits` (część „Dzisiaj”) i `QuietHabitDialog`:
  - nagłówek „Nawyki i sen” + `DayNav` („←” poprzedni dzień, napis „Dziś · środa, 18 listopada” albo „Wtorek, 17 listopada”, „→” tylko gdy nie dziś) + ciemny przycisk „Nowy nawyk”;
  - karta listy: „Dzisiaj” / nazwa dnia, „X z Y zaplanowanych”, pasek i procent z `dayScore`; wiersz = checkbox (optymistycznie, przy błędzie cofnięcie + toast z komunikatem), nazwa (przekreślona po odhaczeniu), pod nią `scheduleLabel`, po prawej meta: seria („12 dni z rzędu” / „2 tygodnie z rzędu”), `weekly` → „2 z 3 w tym tyg.”, `none` → „bez planu”; nawyki niezaplanowane na ten dzień (np. `days` w inny dzień) są na dole, przygaszone, z dopiskiem „nie dziś”, ale dalej da się je odhaczyć;
  - pusta lista: krótki opis i przycisk „Nowy nawyk” (jak w `QuietEmpty`, widok Nawyki);
  - `HabitDialog` (nowy / edycja): nazwa, przełącznik 4 harmonogramów, przyciski Pn–Nd, licznik −/+ 1–7, zdanie wyjaśnienia jak w makiecie, podgląd najbliższych 14 dni; bez przypomnienia (etap 2b). Przy edycji zmiany harmonogramu dopisek „Zmiana obowiązuje od dziś. Wcześniejsze dni zostają bez zmian.”;
  - klik w nazwę nawyku otwiera `HabitDetail` (szuflada z prawej, mobile od dołu): nazwa, harmonogram, seria, heatmapa roczna tego nawyku (zielony = odhaczony, `#E6E6E4` = zaplanowany niezrobiony, `#F4F4F3` = niezaplanowany), przyciski „Edytuj” i „Archiwizuj” (potwierdzenie: „Nawyk zniknie z listy. Historia zostanie.”).
- [ ] **Step 2:** `npm run build` PASS. Weryfikacja wizualna jak w etapie 1b: tymczasowa strona testowa bez logowania z danymi przykładowymi, zrzuty do `/tmp/rhytm-shots/` (`habits-list.png`, `habit-dialog.png`, `habit-detail.png`), strona usunięta, nic z niej w commicie.
- [ ] **Step 3:** `git commit -m "feat(habits): lista dnia, okno nawyku i szczegóły nawyku"`

### Task 8: Heatmapa i sekcja snu na ekranie Nawyki

**Files:**
- Create: `src/components/habits/HabitHeatmap.tsx`, `src/components/sleep/SleepForm.tsx`, `src/components/sleep/SleepChart.tsx`, `src/components/RangeSwitch.tsx`
- Modify: `src/app/(app)/nawyki/page.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4, 6.
- Produces: `<RangeSwitch value onChange />` (Miesiąc / 3 miesiące / Pół roku / Rok) używany przez heatmapę i wykres.

- [ ] **Step 1:** Według ekranu `QuietHabits`:
  - heatmapa pod listą: tytuł zależny od zakresu („Ostatnie pół roku”), podpis „% nawyków dziennie”, `RangeSwitch`; `month` = kalendarz 7×6 z numerami dni w kolorze poziomu (dziś obwiedzione), pozostałe = siatka tygodni z etykietami miesięcy i Pn/Śr/Pt; rozmiar kratki 30/22/18/14 px (`month`/`quarter`/`half`/`year`, przy `year` mniejszy, jeśli nie mieści się w 880 px); legenda „mniej … więcej”; pod spodem „Średnio X% · najdłuższa seria N dni” z `heatStats`; `title` kratki „18 lis · 75%”. Zmiana zakresu pobiera dane przez akcję serwera tylko dla brakującego okresu (dane `half` są ładowane od razu ze stroną).
  - sekcja „Sen” (nagłówek h2) pod heatmapą: `SleepForm` dla wybranego dnia (`?d=`): „Noc 17 → 18 listopada”, czas snu liczony na żywo, pola „Zasnąłem” i „Obudziłem się” (`type="time"`), samopoczucie 1–5 (przełącznik, podpisy „fatalnie” / „świetnie”), notatka, „Zapisz” i przy istniejącym wpisie „Usuń”; błędy walidacji pod polami;
  - `SleepChart`: `RangeSwitch`, podpis („godziny snu · każda noc” / „średnia tygodniowa” / „średnia miesięczna”), oś 0 / 5 h / 10 h, linia celu z napisem „cel 8 h” (z profilu), słupki według Global Constraints, `title` słupka, etykiety pod słupkami bez nachodzenia (co 5. noc / co 2. tydzień przy 26), pod wykresem „Średnio 7 h 05 · zaśnięcie 23:52 · samopoczucie 3,6/5” z `sleepStats`; brak danych → napis „Brak wpisów w tym okresie”.
- [ ] **Step 2:** `npm run build`, `npm test` PASS; zrzuty `heatmap-half.png`, `heatmap-month.png`, `sleep.png` jak w Task 7.
- [ ] **Step 3:** `git commit -m "feat(habits): heatmapa z zakresami i dziennik snu z wykresem"`

### Task 9: Ekran Dziś + menu + start aplikacji

**Files:**
- Create: `src/app/(app)/dzis/page.tsx`, `src/components/today/TodayPlan.tsx`, `src/components/today/TodayHabits.tsx`, `src/components/today/TodaySleep.tsx`, `src/components/today/SummaryStrip.tsx`
- Modify: `src/components/nav/AppNav.tsx`, `src/app/page.tsx`, `src/proxy.ts` (jeśli trasy są tam wymienione)

**Interfaces:**
- Consumes: `listOccurrences` (`src/lib/calendar/list-occurrences.ts`), akcje zadań z `kalendarz/actions.ts` (`listTasks`, `toggleTask`), Tasks 2, 4, 5, 6.

- [ ] **Step 1:** Według ekranu `QuietToday` bez części sportowej, szybkiego dodawania i „Wniosku tygodnia”:
  - nagłówek: „Dzień dobry, {imię z Clerka}” (bez imienia: „Dzień dobry”) i data „Środa, 18 listopada”;
  - pasek podsumowania z trzema kafelkami: Zadania (zrobione z wszystkich dzisiejszych), Nawyki (z `dayScore`), Sen (ostatnia noc + samopoczucie, albo „Brak wpisu” z linkiem „Zapisz sen”), każdy z cienkim paskiem;
  - lewa kolumna „Plan dnia”: dzisiejsze wystąpienia w kolejności godzin, kropka kategorii, godziny, licznik zadań, lista zadań do odhaczenia (`toggleTask`, optymistycznie), trwający blok z plakietką „Teraz” i tłem `#FBFBFA`; link „Otwórz w kalendarzu →”; brak bloków → opis + „Dodaj blok” (link do `/kalendarz`);
  - prawa kolumna: „Nawyki” (odhaczanie na dziś, link „Wszystkie →”) i „Sen” (ostatnia noc, mini wykres 7 nocy z linią celu, link „Edytuj” do `/nawyki`);
  - menu: pozycja „Dziś” (ikona słońca) jako pierwsza, na komputerze i w dolnym pasku telefonu; `/` przekierowuje na `/dzis`; po zalogowaniu Clerk kieruje na `/dzis` (`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` w `.env.local.example` i README).
- [ ] **Step 2:** `npm run build`, `npm test` PASS; zrzut `today.png`.
- [ ] **Step 3:** `git commit -m "feat(today): ekran Dziś z planem dnia, nawykami i snem"`

### Task 10: Test end-to-end i README

**Files:**
- Create: `e2e/habits.spec.ts`
- Modify: `README.md`

- [ ] **Step 1:** `e2e/habits.spec.ts`: utworzenie nawyku „Woda e2e” (codziennie) → widoczny na liście i na `/dzis`; odhaczenie na `/dzis` → na `/nawyki` odhaczony, „1 z 1”; zapis snu 23:40–07:10, samopoczucie 4 → „7 h 30” w formularzu i na `/dzis`; archiwizacja nawyku → znika z listy. Test odporny na ponowne uruchomienie (sprząta po sobie albo używa unikalnej nazwy z datą i godziną).
- [ ] **Step 2:** README: migracja `0003_habits_sleep.sql` (uruchamiana przed wdrożeniem kodu etapu 2 — dodaje tabele i kolumnę, nic nie usuwa, więc stary kod dalej działa), nowy adres startowy `/dzis`, cel snu w ustawieniach.
- [ ] **Step 3:** `npx tsc --noEmit`, `npm test`, `npm run test:db`, `npm run build` PASS; `npm run test:e2e` tylko jeśli środowisko pozwala (inaczej uruchamia Mejson).
- [ ] **Step 4:** `git commit -m "test(e2e): nawyki, sen i ekran Dziś; README etapu 2"`

## Po etapie (dla Mejsona albo Claude przez konektor Supabase)

1. Migracja `0003_habits_sleep.sql` na bazie Supabase (można przed merge'em — niczego nie usuwa).
2. `npm run dev`: dodaj kilka nawyków z różnymi harmonogramami, poodhaczaj, zapisz sen, sprawdź `/dzis` na komputerze i telefonie. Potem `npm run test:e2e`.
