# Etap 1b: kalendarz w cichym stylu + kategorie — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kalendarz główny wygląda jak ekrany „Kalendarz · widok główny / miesiąca / dnia” z płótna, a kolor bloku zastępują kategorie użytkownika (nazwa + kolor) z filtrem w menu bocznym, zakładkami nad kalendarzem i oknem „Nowa kategoria”. W menu bocznym jest mini kalendarz.

**Architecture:** Nowa tabela `categories` (RLS jak reszta) i migracja `0002`, która zamienia `blocks.color` / `block_exceptions.color` na `category_id` bez utraty danych. W logice kalendarza (`src/lib/calendar/`) pole `color` staje się `categoryId`; kolor do rysowania bierze się z kategorii. Menu boczne (`AppNav`) dostaje „slot”, do którego strona kalendarza wstawia przez portal mini kalendarz i listę kategorii. Filtrowanie (ukryte kategorie, zakładka) dzieje się po stronie klienta na już wczytanych wystąpieniach, bez dodatkowych zapytań.

**Tech Stack:** bez zmian względem etapu 1 (Next.js 16, Clerk, Supabase, FullCalendar 7, coss ui, date-fns, Vitest, Playwright, testy SQL przez `npm run test:db`). Nowych zależności nie dodajemy.

**Spec:** `docs/superpowers/specs/2026-11-13-life-organizer-design.md` (wersja 2: sekcje 4 „Wygląd”, 4.1, 5, 7, 8 pkt 2). Wzór wyglądu: płótno „Rhytm — ekrany aplikacji”, ekrany `QuietCalendar`, `QuietCalendarMonth`, `QuietCalendarDay`, `QuietCategoryDialog`.

## Global Constraints

- Interfejs po polsku. Tydzień od poniedziałku, format 24h, strefa czasowa z profilu.
- Klucze: tylko `.env.local`. Nigdy `service_role` ani sekretnego klucza Supabase w kodzie i w testach.
- Odczyty kalendarza dalej przez `GET /api/occurrences` (nie Server Action w trakcie renderu FullCalendar). Zapisy przez Server Actions.
- Paleta kategorii ma dokładnie 8 kolorów, jedyne źródło: `src/lib/calendar/colors.ts`. Wartości (id: dot / bg / border / ink / mid):
  - `blue`: `#4E8FE0` / `#F4F8FE` / `#DCE8F8` / `#22578F` / `#5B84B1`
  - `teal`: `#3AA197` / `#F1F8F7` / `#D4EAE6` / `#1C625D` / `#5A8E89`
  - `gray`: `#9B9A97` / `#F7F7F6` / `#E8E8E6` / `#37352F` / `#7D7C78`
  - `rose`: `#D86B88` / `#FDF4F6` / `#F3DCE2` / `#9A3552` / `#B36B80`
  - `orange`: `#D9733A` / `#FBF3EE` / `#F1DDD0` / `#8A4520` / `#B0714A`
  - `violet`: `#7C6BD6` / `#F5F3FD` / `#E4DFF7` / `#4A3D99` / `#7C70B8`
  - `green`: `#3E9B63` / `#F1F8F3` / `#D6EBDD` / `#23633C` / `#5C8E6E`
  - `amber`: `#D4A12A` / `#FCF8EC` / `#F1E6C4` / `#7A5A0E` / `#9C8240`
- Kolory cichego stylu (tokeny): tło `#FFFFFF`, pasek boczny `#FBFBFA`, obramowanie paska `#EDEDEC`, obramowania kart/siatki `#EAEAE8`, linie siatki `#F3F3F1`, tekst `#191816`, tekst drugi `#37352F`, przygaszony `#7D7C78`, słaby `#9B9A97`, aktywna pozycja menu `#EFEFED`, tło przełączników `#F4F4F3`, linia „teraz” `#E5484D`. Font interfejsu Inter, Bricolage Grotesque tylko w logo.
- Kategoria: nazwa po przycięciu 1–40 znaków, unikalna u użytkownika bez względu na wielkość liter. Kolor z palety. Kilka kategorii może mieć ten sam kolor (okno tylko ostrzega).
- Domyślne kategorie nowego użytkownika (kolejność = `position`): Nauka `blue`, Uczelnia `teal`, Praca `gray`, Osobiste `rose`.
- Usuwania kategorii nie ma w tym etapie. Kategorii „Sport” też nie (dochodzi w etapie 3).
- Szerokość: kalendarz na całą szerokość. Szczegóły bloku tylko po kliknięciu.

## Review Focus

1. Istniejące bloki Mejsona po migracji: każdy blok i każdy wyjątek z nadpisanym kolorem dostaje kategorię w odpowiadającym kolorze (`red` → `rose`, `purple` → `violet`, reszta bez zmian), nic nie znika. Test: Task 2, `legacy_seed.sql` + asercje.
2. Ukryta kategoria a nowy blok: utworzenie bloku w ukrytej kategorii (albo przy zakładce innej kategorii) nie może sprawić, że blok „zniknie” po zapisie. Oczekiwane: kategoria się odkrywa, a zakładka wraca na „Wszystkie”. Test: Task 8, `revealAfterCreate`.
3. Nazwa kategorii różniąca się tylko wielkością liter albo spacjami („ nauka ” przy istniejącej „Nauka”) daje czytelny błąd, a nie wyjątek z bazy. Test: Task 4.
4. Mini kalendarz na przełomie roku: grudzień 2026 i styczeń 2027 mają tydzień 53, a pierwszy wiersz stycznia zaczyna się 2026-12-28. Test: Task 6.
5. Dwa równoległe wejścia nowego użytkownika (dwie karty) nie tworzą podwójnych domyślnych kategorii. Test: Task 2 (unikalny indeks) i Task 4 (`ensureCategories` traktuje `23505` jako sukces).

---

### Task 1: Paleta i tokeny cichego stylu

**Files:**
- Modify: `src/lib/calendar/colors.ts`, `src/app/globals.css`
- Create: `src/lib/calendar/colors.test.ts`

**Interfaces:**
- Produces:
  - `CATEGORY_COLORS: readonly { id: CategoryColorId; label: string; dot: string; bg: string; border: string; ink: string; mid: string }[]` (8 pozycji, kolejność jak w Global Constraints).
  - `type CategoryColorId = 'blue' | 'teal' | 'gray' | 'rose' | 'orange' | 'violet' | 'green' | 'amber'`.
  - `categoryColor(id: string): CategoryColor` (nieznane id → `gray`).
  - `legacyColorId(old: string): CategoryColorId` (`red`→`rose`, `purple`→`violet`, `blue|green|orange|gray`→ to samo, inne → `gray`).
  - Etykiety: Niebieski, Morski, Szary, Różowy, Pomarańczowy, Fioletowy, Zielony, Bursztynowy.

- [ ] **Step 1: Test** `colors.test.ts`:

```ts
expect(CATEGORY_COLORS.map((c) => c.id)).toEqual(['blue', 'teal', 'gray', 'rose', 'orange', 'violet', 'green', 'amber']);
expect(categoryColor('violet').dot).toBe('#7C6BD6');
expect(categoryColor('nie-ma').id).toBe('gray');
expect(legacyColorId('red')).toBe('rose');
expect(legacyColorId('purple')).toBe('violet');
expect(legacyColorId('green')).toBe('green');
```

- [ ] **Step 2:** `npx vitest run src/lib/calendar/colors.test.ts` → FAIL (`legacyColorId` nie istnieje).
- [ ] **Step 3:** Zaimplementuj paletę. W `globals.css` ustaw tokeny `:root` według Global Constraints: `--background:#FFFFFF`, `--sidebar:#FBFBFA`, `--sidebar-border:#EDEDEC`, `--border:#EAEAE8`, `--muted:#F4F4F3`, `--muted-foreground:#7D7C78`, `--accent:#EFEFED`, `--primary:#191816`, `--primary-foreground:#FFFFFF`, `--ring: rgba(55,53,47,0.25)` oraz nowe `--faint:#9B9A97`, `--grid-line:#F3F3F1`, `--now:#E5484D`. Font `--font-sans` = Inter (już w projekcie). Pozostałe pliki, które używały pól `bar` z palety (`MainCalendar.tsx`, `BlockForm.tsx`, `BlockPanel.tsx`), przepnij na `dot` (to tylko podmiana nazwy pola, wygląd zmieniają Taski 7–9).
- [ ] **Step 4:** `npm test` → PASS, `npm run build` → bez błędów typów.
- [ ] **Step 5:** `git commit -m "feat(style): paleta 8 kolorów kategorii i tokeny cichego stylu"`

### Task 2: Tabela `categories` i migracja danych

**Files:**
- Create: `supabase/migrations/0002_categories.sql`, `supabase/tests/legacy_seed.sql`, `supabase/tests/categories.test.sql`
- Modify: `scripts/test-db.sh`, `supabase/tests/rls.test.sql`, `src/lib/db/types.ts`

**Interfaces:**
- Produces (SQL):
  - `categories (id uuid pk default gen_random_uuid(), user_id text not null default (auth.jwt()->>'sub'), name text not null check (length(trim(name)) between 1 and 40), color text not null check (color in ('blue','teal','gray','rose','orange','violet','green','amber')), position int not null default 0, visible bool not null default true, is_system bool not null default false, created_at timestamptz default now())`, unikalny indeks `categories_user_name_idx on (user_id, lower(trim(name)))`.
  - `blocks.category_id uuid not null references categories(id) on delete restrict`; `block_exceptions.category_id uuid null references categories(id) on delete restrict`. Kolumny `color` usunięte z obu tabel.
  - RLS `categories_own` jak `blocks_own`. Polityka `blocks_own` dostaje w `with check` dodatkowo `exists (select 1 from categories c where c.id = category_id and c.user_id = (select auth.jwt()->>'sub'))`. To samo dla `block_exceptions_own`, gdy `category_id is not null`.
  - `grant select, insert, update, delete on categories to authenticated`.
- Produces (TS): typy `categories` w `Database` oraz `category_id` zamiast `color` w `blocks` i `block_exceptions`.

- [ ] **Step 1: Seed i asercje.** `legacy_seed.sql` (uruchamiany jako postgres, po `0001`, przed `0002`): użytkownik `legacy_u` z trzema blokami w kolorach `blue`, `red`, `purple` i jednym wyjątkiem z `color = 'green'`. `categories.test.sql`:
  - po migracji `legacy_u` ma dokładnie 4 kategorie o kolorach `{blue, rose, violet, green}` i nazwach `Niebieski`, `Różowy`, `Fioletowy`, `Zielony`;
  - blok dawniej `red` wskazuje na kategorię `rose`, wyjątek wskazuje na kategorię `green`;
  - jako `user_a` (JWT): insert kategorii „Nauka”, potem „ nauka ” → błąd unikalności;
  - jako `user_b`: insert bloku z `category_id` kategorii `user_a` → odrzucony przez RLS;
  - `user_b` nie widzi kategorii `user_a`.
- [ ] **Step 2:** W `scripts/test-db.sh` kolejność: shim → `0001_init.sql` → `legacy_seed.sql` → pozostałe migracje (`0002…`) → `rls.test.sql` → `categories.test.sql`. W `rls.test.sql` przed każdym insertem bloku dodaj insert kategorii tego użytkownika i podawaj `category_id`. `npm run test:db` → FAIL (brak `0002`).
- [ ] **Step 3:** Napisz `0002_categories.sql`: tabela, indeks, RLS i granty; potem dla każdej pary (`user_id`, kolor) z `blocks` i z wyjątków (przez `blocks.user_id`) wstaw kategorię z kolorem po mapowaniu `legacyColorId` (w SQL jako `case`) i nazwą = etykieta koloru; uzupełnij `category_id`, ustaw `not null` na `blocks`, usuń kolumny `color`. Całość w jednej transakcji.
- [ ] **Step 4:** `npm run test:db` → wszystkie asercje bez `FAIL`. Zaktualizuj `src/lib/db/types.ts` ręcznie (bez generatora).
- [ ] **Step 5:** `git commit -m "feat(db): kategorie bloków i migracja kolorów na kategorie"`

### Task 3: `color` → `categoryId` w logice kalendarza

**Files:**
- Modify: `src/lib/calendar/{types,expand,mapping,plan-edit,execute,validation,block-form,calendar-events}.ts` i ich testy, `src/app/(app)/kalendarz/actions.ts`, `src/lib/calendar/list-occurrences.ts`

**Interfaces:**
- Consumes: kolumny `category_id` z Taska 2.
- Produces:
  - `BlockSeries.categoryId: string`, `BlockException.categoryId?: string`, `Occurrence.categoryId: string`, `BlockFormValue.categoryId: string`, `BlockChange` z `categoryId`, `ExceptionField` z `'categoryId'` zamiast `'color'`.
  - `validateBlockFields({ categoryId?: string, … })`: `categoryId` musi być UUID, inaczej `Error('Nieznana kategoria')`. Własność kategorii sprawdza RLS.
  - `emptyBlockForm(startLocal: string, durationMin: number, categoryId: string): BlockFormValue`.
  - `occurrenceToEvent(o: CalendarOccurrence, colorOf: (categoryId: string) => CategoryColorId)`: klasa `rh-ev rh-ev-<colorId>`.

- [ ] **Step 1:** Zmień istniejące testy tak, żeby używały `categoryId` (stały UUID np. `'11111111-1111-4111-8111-111111111111'`) zamiast `color`. Dodaj w `validation.test.ts`: `expect(() => validateBlockFields({ categoryId: 'blue' })).toThrow('Nieznana kategoria')`. W `calendar-events.test.ts`: `occurrenceToEvent(o, () => 'violet').class` → `'rh-ev rh-ev-violet'`.
- [ ] **Step 2:** `npm test` → FAIL (pola nie istnieją).
- [ ] **Step 3:** Zmiana nazwy w całej logice i w akcjach (kolumna `category_id`). Zachowanie bez zmian: nadpisanie kategorii w jednym wystąpieniu działa jak dotąd nadpisanie koloru.
- [ ] **Step 4:** `npm test` → PASS (wszystkie dotychczasowe testy), `npm run build` → OK.
- [ ] **Step 5:** `git commit -m "refactor(calendar): kategoria zamiast koloru w blokach i wyjątkach"`

### Task 4: Kategorie — walidacja, domyślne, akcje

**Files:**
- Create: `src/lib/categories/categories.ts`, `src/lib/categories/categories.test.ts`, `src/app/(app)/kalendarz/category-actions.ts`
- Modify: `src/lib/profile.ts`

**Interfaces:**
- Produces:
  - `type Category = { id: string; name: string; color: CategoryColorId; position: number; visible: boolean; isSystem: boolean }`.
  - `DEFAULT_CATEGORIES: { name: string; color: CategoryColorId }[]` (Global Constraints).
  - `validateCategoryInput(input: { name: string; color: string }, existing: Pick<Category, 'id' | 'name'>[], editingId?: string): { name: string; color: CategoryColorId }`: przycina nazwę; błędy `'Nazwa nie może być pusta'`, `'Nazwa może mieć najwyżej 40 znaków'`, `'Kategoria o tej nazwie już istnieje'`, `'Nieznany kolor'`.
  - `colorUsage(categories: Category[], color: CategoryColorId, exceptId?: string): string | null`: nazwa pierwszej innej kategorii z tym kolorem albo `null`.
  - `ensureCategories(): Promise<void>`: gdy użytkownik nie ma żadnej kategorii, wstawia domyślne jednym insertem; błąd unikalności (`23505`, równoległe wejście z drugiej karty) traktuje jako sukces. (Upsert z `onConflict` nie zadziała, bo unikalność jest na wyrażeniu `lower(trim(name))`.) Wywoływana w `ensureProfile` po upsercie profilu.
  - Server Actions w `category-actions.ts`: `listCategories(): Promise<Category[]>` (po `position`, potem `created_at`), `createCategory(input: { name: string; color: string }): Promise<Category>` (`position` = max + 1), `updateCategory(id: string, patch: { name?: string; color?: string; visible?: boolean }): Promise<Category>`. Walidacja przez `validateCategoryInput` z aktualną listą. Błąd unikalności z bazy (wyścig) zamieniony na `'Kategoria o tej nazwie już istnieje'`.

- [ ] **Step 1: Testy** `categories.test.ts`:

```ts
const existing = [{ id: 'a', name: 'Nauka' }];
expect(validateCategoryInput({ name: '  Projekty ', color: 'violet' }, existing)).toEqual({ name: 'Projekty', color: 'violet' });
expect(() => validateCategoryInput({ name: ' nauka ', color: 'blue' }, existing)).toThrow('Kategoria o tej nazwie już istnieje');
expect(validateCategoryInput({ name: 'NAUKA', color: 'blue' }, existing, 'a').name).toBe('NAUKA'); // zmiana wielkości liter własnej nazwy
expect(() => validateCategoryInput({ name: '   ', color: 'blue' }, [])).toThrow('Nazwa nie może być pusta');
expect(() => validateCategoryInput({ name: 'x'.repeat(41), color: 'blue' }, [])).toThrow('Nazwa może mieć najwyżej 40 znaków');
expect(() => validateCategoryInput({ name: 'A', color: 'red' }, [])).toThrow('Nieznany kolor');
expect(colorUsage([cat('a', 'Nauka', 'blue')], 'blue')).toBe('Nauka');
expect(colorUsage([cat('a', 'Nauka', 'blue')], 'blue', 'a')).toBeNull();
expect(DEFAULT_CATEGORIES.map((c) => c.name)).toEqual(['Nauka', 'Uczelnia', 'Praca', 'Osobiste']);
```

- [ ] **Step 2:** `npx vitest run src/lib/categories` → FAIL.
- [ ] **Step 3:** Zaimplementuj `categories.ts`, akcje i `ensureCategories`.
- [ ] **Step 4:** `npm test` → PASS, `npm run build` → OK.
- [ ] **Step 5:** `git commit -m "feat(categories): walidacja, domyślne kategorie i akcje serwera"`

### Task 5: Menu boczne w cichym stylu + slot na treść strony

**Files:**
- Modify: `src/components/nav/AppNav.tsx`
- Create: `src/components/nav/NavSlot.tsx`

**Interfaces:**
- Produces: `<NavSlot>{children}</NavSlot>` (klient): wstawia dzieci przez `createPortal` do elementu `#rh-nav-slot` w pasku bocznym. Na ekranach bez paska (poniżej `md`) nic nie renderuje. Po odmontowaniu strony treść znika.

- [ ] **Step 1:** Przebuduj `AppNav` według ekranu `QuietCalendar` (sekcja menu): tło `--sidebar`, prawa krawędź `--sidebar-border`, szerokość 248 px, padding 18/12 px, logo (znak 20 px + „rhytm” Bricolage 19 px, 800). Nagłówek sekcji „OGÓLNE” (11 px, wersaliki, `--faint`). Pozycje: wysokość 32 px, zaokrąglenie 6 px, ikona 16 px, kolor ikon `#7D7C78`, tekst `#5F5E5B`. Aktywna: tło `#EFEFED`, tekst `#191816` 500, ikona `#37352F`. Ikony z `lucide-react` bez kolorów sekcji. Pod listą `<div id="rh-nav-slot" className="flex flex-col gap-5" />`. Na dole: „Ustawienia” i `UserButton` z `showName`. Dolny pasek mobilny: te same szare ikony, aktywna z tłem `#EFEFED`.
- [ ] **Step 2:** `NavSlot` z `useEffect` szukającym `#rh-nav-slot` (portal dopiero po montażu, żeby nie psuć SSR).
- [ ] **Step 3:** Weryfikacja: `npm run build` → OK. `npm run dev`, wejście na `/kalendarz`, `/sport`, `/nawyki`: aktywna pozycja podświetlona, brak kolorowych ikon. Zrzut ekranu menu porównany z płótnem.
- [ ] **Step 4:** `git commit -m "feat(nav): menu boczne w cichym stylu i slot na treść strony"`

### Task 6: Mini kalendarz

**Files:**
- Create: `src/lib/calendar/mini-calendar.ts`, `src/lib/calendar/mini-calendar.test.ts`, `src/components/calendar/MiniCalendar.tsx`

**Interfaces:**
- Produces:
  - `miniCalendarWeeks(month: string /* 'YYYY-MM' */): { week: number; days: { date: string; day: number; inMonth: boolean }[] }[]`: zawsze 6 wierszy po 7 dni, od poniedziałku, `week` = numer tygodnia ISO.
  - `miniHighlight(viewType: 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth', currentStart: string): { kind: 'week'; from: string; to: string } | { kind: 'day'; date: string } | null`.
  - `<MiniCalendar month today highlight onPickDate onMonthChange />`: nagłówek „Listopad 2026” + strzałki (aria „Poprzedni miesiąc” / „Następny miesiąc”), wiersz Pn–Nd, kolumna numerów tygodni (10 px, `#B8B7B4`), dzień 24 px w kole. Dziś: tło `#191816`, biały tekst 600. Dni spoza miesiąca: `#B8B7B4`. Podświetlony tydzień: wiersz z tłem `#EFEFED`, zaokrąglenie 8 px. Podświetlony dzień (widok dnia, nie dziś): tło `#E6E6E4`. Każdy dzień to `button` z `aria-label` „18 listopada 2026”.

- [ ] **Step 1: Testy**

```ts
const nov = miniCalendarWeeks('2026-11');
expect(nov).toHaveLength(6);
expect(nov[0].days[0]).toEqual({ date: '2026-10-26', day: 26, inMonth: false });
expect(nov[0].week).toBe(44);
expect(nov[5].days[6].date).toBe('2026-12-06');
expect(miniCalendarWeeks('2026-06')[0].days[0].date).toBe('2026-06-01'); // miesiąc od poniedziałku
const jan = miniCalendarWeeks('2027-01');
expect(jan[0].days[0].date).toBe('2026-12-28');
expect(jan[0].week).toBe(53);
expect(miniHighlight('timeGridWeek', '2026-11-16')).toEqual({ kind: 'week', from: '2026-11-16', to: '2026-11-22' });
expect(miniHighlight('timeGridDay', '2026-11-18')).toEqual({ kind: 'day', date: '2026-11-18' });
expect(miniHighlight('dayGridMonth', '2026-11-01')).toBeNull();
```

- [ ] **Step 2:** `npx vitest run src/lib/calendar/mini-calendar.test.ts` → FAIL.
- [ ] **Step 3:** Zaimplementuj (date-fns: `startOfISOWeek`, `getISOWeek`, `addDays`) i komponent.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `git commit -m "feat(calendar): mini kalendarz z numerami tygodni"`

### Task 7: Lista kategorii i okno „Nowa kategoria”

**Files:**
- Create: `src/components/calendar/CategoryList.tsx`, `src/components/calendar/CategoryDialog.tsx`

**Interfaces:**
- Consumes: `Category`, `colorUsage`, `validateCategoryInput` (Task 4), `CATEGORY_COLORS` (Task 1).
- Produces:
  - `<CategoryList categories counts onToggle(id) onAdd() onEdit(category) />`: nagłówek „KATEGORIE”, wiersz = `button` z `aria-pressed` = widoczna, kropka 10 px (widoczna: wypełniona kolorem `dot`; ukryta: pusty pierścień 1,5 px), nazwa (ukryta: `#B8B7B4`), licznik po prawej (`counts[id] ?? 0`). Po najechaniu ikona ołówka (`aria-label` „Edytuj kategorię {nazwa}”). Na końcu „+ Dodaj kategorię” (szary, bez ramki).
  - `<CategoryDialog open mode: 'create' | 'edit' initial? categories onSubmit(input) onOpenChange />`: tytuł „Nowa kategoria” / „Edytuj kategorię”. Pole „Nazwa”, grupa „Kolor” (`role="radiogroup"`, 8 kółek 32 px, wybrane z obwódką `#191816`; kolory zajęte przez inne kategorie wyblakłe na 35%, a pod spodem zdanie z `colorUsage`: „Tego koloru używa już kategoria „Nauka”. Możesz go wybrać, ale bloki będą trudniejsze do odróżnienia.”, w przeciwnym razie „Wyblakłe kolory mają już inne kategorie.”). Podgląd: wiersz menu z kropką i blok w kalendarzu w kolorach `bg/border/ink/mid`. Przyciski „Anuluj” i „Dodaj kategorię” / „Zapisz”. Błąd walidacji pod polem nazwy, okno zostaje otwarte. Domyślny kolor nowej kategorii: pierwszy niezajęty z palety, a gdy wszystkie zajęte, `blue`.

- [ ] **Step 1:** Zbuduj komponenty na `Dialog` z coss ui według ekranu `QuietCategoryDialog`.
- [ ] **Step 2:** Weryfikacja ręczna w Tasku 8 (komponenty używa dopiero kalendarz). `npm run build` → OK.
- [ ] **Step 3:** `git commit -m "feat(categories): lista kategorii i okno dodawania"`

### Task 8: Kalendarz w cichym stylu z filtrami

**Files:**
- Create: `src/lib/calendar/filters.ts`, `src/lib/calendar/filters.test.ts`, `src/components/calendar/CalendarWorkspace.tsx`
- Modify: `src/components/calendar/MainCalendar.tsx`, `src/components/calendar/calendar.css`, `src/app/(app)/kalendarz/page.tsx`

**Interfaces:**
- Consumes: Taski 3–7.
- Produces:
  - `filterOccurrences<T extends { categoryId: string }>(list: T[], filter: { tab: 'all' | string; hidden: ReadonlySet<string> }): T[]`.
  - `categoryCounts(list: { categoryId: string }[]): Record<string, number>`.
  - `revealAfterCreate(state: { tab: 'all' | string; hidden: ReadonlySet<string> }, categoryId: string): { tab: 'all' | string; hidden: Set<string>; unhide: boolean }`: zwraca `tab: 'all'`, gdy zakładka to inna kategoria; usuwa `categoryId` z `hidden` i ustawia `unhide: true`, gdy był ukryty.
  - `CalendarWorkspace` (klient): trzyma `categories` (start z serwera), filtr i ostatnio wczytane wystąpienia. Renderuje `<NavSlot>` z `MiniCalendar` + `CategoryList` oraz `MainCalendar`.
  - `MainCalendar` dostaje propsy `categories`, `filter`, `onOccurrencesLoaded(list)`, `onNavigate({ viewType, currentStart })` i metodę `gotoDate(date)` przez ref.

- [ ] **Step 1: Testy** `filters.test.ts`:

```ts
const list = [{ categoryId: 'n' }, { categoryId: 'p' }, { categoryId: 'n' }];
expect(filterOccurrences(list, { tab: 'all', hidden: new Set() })).toHaveLength(3);
expect(filterOccurrences(list, { tab: 'n', hidden: new Set() })).toHaveLength(2);
expect(filterOccurrences(list, { tab: 'all', hidden: new Set(['n']) })).toHaveLength(1);
expect(categoryCounts(list)).toEqual({ n: 2, p: 1 });
expect(revealAfterCreate({ tab: 'p', hidden: new Set(['n']) }, 'n')).toEqual({ tab: 'all', hidden: new Set(), unhide: true });
expect(revealAfterCreate({ tab: 'all', hidden: new Set() }, 'n')).toEqual({ tab: 'all', hidden: new Set(), unhide: false });
```

- [ ] **Step 2:** `npx vitest run src/lib/calendar/filters.test.ts` → FAIL. Zaimplementuj `filters.ts` → PASS.
- [ ] **Step 3:** Strona `/kalendarz`: wczytuje profil i `listCategories()` w Suspense, renderuje `CalendarWorkspace`. Ukrycie kategorii = `hidden` z `categories.visible === false`; klik w kropkę zmienia stan od razu i woła `updateCategory(id, { visible })` (przy błędzie cofa i pokazuje toast).
- [ ] **Step 4:** `MainCalendar` według ekranów `QuietCalendar*`:
  - pasek narzędzi (przyklejony u góry, białe tło): mały okruszek „Rhytm › Kalendarz”, tytuł okresu (22 px, 600, Inter, np. „16 – 22 lis 2026 · tydzień 47”), grupa „← Dzisiaj →” w jednej ramce, przełącznik Dzień/Tydzień/Miesiąc (tło `#F4F4F3`, aktywny biały z cieniem), ciemny przycisk „+ Dodaj blok”;
  - pod nim zakładki-filtry: „Wszystkie” + po jednej na kategorię (te same style co przełącznik);
  - `loadEvents` trzyma ostatnią odpowiedź dla danego zakresu w `ref` i woła `onOccurrencesLoaded`; zmiana filtra woła `refetchEvents()`, które dla tego samego zakresu bierze dane z `ref` (bez zapytania); filtr stosuje `filterOccurrences`;
  - po utworzeniu bloku `revealAfterCreate` (i `updateCategory(…, { visible: true })`, gdy `unhide`);
  - `datesSet` → `onNavigate`, mini kalendarz podąża za miesiącem kalendarza; klik w dzień mini kalendarza → `gotoDate`.
- [ ] **Step 5:** `calendar.css` według cichego stylu: siatka z liniami `--grid-line`, kolumny rozdzielone `#F0F0EE`, weekend `#FCFCFB`, nagłówek dnia „pon 16” (12 px, `#7D7C78`; dziś: numer w ciemnym kole 22 px), godziny 11 px `#9B9A97` wyśrodkowane na linii godziny, linia „teraz” `--now` z kropką. Blok: tło `bg`, ramka 1 px `border`, zaokrąglenie 6 px, tytuł 12 px 500 w kolorze `ink`, godzina 11 px w kolorze `mid`, bez lewego paska. Widok miesiąca: komórki z numerem dnia, maks. 2 bloki jako „żetony” (kropka koloru + godzina + tytuł) i „+N więcej”.
- [ ] **Step 6:** Weryfikacja ręczna (`npm run dev`): ukrycie kategorii chowa jej bloki we wszystkich widokach, a licznik zostaje. Zakładka zawęża widok. Dodanie bloku w ukrytej kategorii ją odkrywa. Mini kalendarz podświetla tydzień i dzień i przenosi do klikniętego dnia. Zrzuty trzech widoków porównane z płótnem.
- [ ] **Step 7:** `npm test` i `npm run build` → OK. `git commit -m "feat(calendar): cichy styl, mini kalendarz i filtrowanie po kategoriach"`

### Task 9: Formularz i panel bloku w cichym stylu + test end-to-end

**Files:**
- Modify: `src/components/calendar/BlockForm.tsx`, `src/components/calendar/BlockPanel.tsx`, `src/components/calendar/ScopeDialog.tsx`, `e2e/calendar.spec.ts`, `README.md`

**Interfaces:**
- Consumes: `Category[]` z `CalendarWorkspace`.
- Produces: `BlockForm` z propem `categories: Category[]` i polem „Kategoria” (`role="radiogroup"`, żetony: kropka 8 px + nazwa, wybrany z ramką `#37352F`). Domyślna kategoria nowego bloku: zakładka, gdy wybrana; inaczej pierwsza widoczna; inaczej pierwsza.

- [ ] **Step 1:** `BlockForm` i `ScopeDialog` według ekranu „Nowy blok + zakres” (karta 480–520 px, nagłówek z linią, pola 36 px, przyciski: jasny „Anuluj”, ciemny główny; przyciski powtarzania w jednej linii bez zawijania tekstu).
- [ ] **Step 2:** `BlockPanel` na komputerze: panel 360 px przy prawej krawędzi obszaru kalendarza, bez przyciemnienia tła (`modal={false}`), cień `0 12px 32px rgba(25,24,22,0.10)`, zamykany X i klawiszem Esc. Kalendarz pod spodem zostaje na całą szerokość. Na telefonie bez zmian (szuflada od dołu). Treść: kropka + kategoria (+ „· powtarzanie”), tytuł, data i godziny, pasek postępu zadań, lista zadań, notatka.
- [ ] **Step 3:** `e2e/calendar.spec.ts`: dotychczasowy scenariusz + nowy: „+ Dodaj kategorię” → nazwa „Projekty e2e”, kolor Fioletowy → kategoria widoczna w menu; blok w tej kategorii; klik w kropkę kategorii ukrywa blok, ponowny klik go pokazuje. Uruchom `npm run test:e2e` → PASS.
- [ ] **Step 4:** `README.md`: dopisz w sekcji o bazie, że trzeba uruchomić też `supabase/migrations/0002_categories.sql` (po `0001`), oraz że migracja zamienia kolory istniejących bloków na kategorie o nazwach kolorów, które można potem zmienić.
- [ ] **Step 5:** `npm test`, `npm run test:db`, `npm run build` → OK. `git commit -m "feat(calendar): formularz i panel bloku w cichym stylu, e2e kategorii"`

## Po etapie (dla Mejsona, poza kodem)

1. W Supabase → SQL Editor uruchom `supabase/migrations/0002_categories.sql`. Twoje istniejące bloki dostaną kategorie o nazwach kolorów (np. „Niebieski”), które możesz od razu przemianować ołówkiem w menu.
2. `npm run dev` i przeklikaj: menu, mini kalendarz, ukrywanie kategorii, zakładki, nowa kategoria, nowy blok.
