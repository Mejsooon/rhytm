# Rhytm

Aplikacja do organizacji życia: kalendarz bloków czasu z zadaniami (etap 1), a dalej kalendarz sportowy, nawyki i sen.

Technologie: Next.js 16, Clerk (logowanie), Supabase (baza PostgreSQL z RLS), FullCalendar v7.

> Sekretów (kluczy) nigdy nie wpisuj do README ani do repozytorium. Trzymaj je tylko w pliku `.env.local`,
> który jest w `.gitignore`.

---

## Pierwsze uruchomienie krok po kroku

Potrzebujesz: Node.js 20+ i npm, konto w [Clerk](https://clerk.com) i projekt w [Supabase](https://supabase.com).

### Krok 1. Zainstaluj zależności

```bash
npm install
```

### Krok 2. Utwórz plik `.env.local`

Skopiuj wzór i uzupełnij puste wartości:

```bash
cp .env.local.example .env.local
```

| Zmienna | Skąd ją wziąć |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → **API Keys** → Publishable key (zaczyna się od `pk_`). Wzór ma już klucz instancji deweloperskiej. |
| `CLERK_SECRET_KEY` | Clerk Dashboard → **API Keys** → Secret key (zaczyna się od `sk_`). **Sekret** – tylko w `.env.local`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → **Project Settings → API** → Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → **Project Settings → API** → klucz `anon` / publishable. |

Pozostałe zmienne `NEXT_PUBLIC_CLERK_*` (adresy logowania i przekierowań) zostaw takie jak we wzorze.

### Krok 3. Połącz Clerka z Supabase (najważniejszy krok)

Aplikacja nie używa Supabase Auth. Supabase dostaje token sesji Clerka i z niego czyta ID użytkownika
(`auth.jwt()->>'sub'`), a polityki RLS wpuszczają tylko rolę `authenticated`.

1. **W Clerku:** Clerk Dashboard → **Integrations → Supabase** (albo strona „Connect with Supabase”) → włącz integrację.
   Dzięki temu token sesji ma pole `role: "authenticated"`.
   **Bez tego każde zapytanie idzie jako `anon` i wszystko kończy się błędem** (pusty kalendarz, komunikat „Coś poszło nie tak”).
   Skopiuj z tej strony **Clerk domain** (np. `twoja-nazwa.clerk.accounts.dev`).
2. **W Supabase:** Supabase Dashboard → **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Clerk**
   i wklej domenę Clerka z punktu 1.
3. Jeśli używasz innej instancji Clerka niż ta z repozytorium, zmień też `domain` w sekcji
   `[auth.third_party.clerk]` w pliku `supabase/config.toml` (ważne tylko dla lokalnego Supabase CLI).

### Krok 4. Utwórz tabele w bazie

Masz dwie drogi, wybierz jedną:

- **Edytor SQL (najprościej):** Supabase Dashboard → **SQL Editor** → wklej całą zawartość pliku
  `supabase/migrations/0001_init.sql` → **Run**, a potem w ten sam sposób
  `supabase/migrations/0002_categories.sql` (kategorie bloków; uruchom ją po `0001`).
- **Supabase CLI:** `supabase link --project-ref <id-projektu>`, a potem `supabase db push`.

Migracja tworzy tabele (`profiles`, `blocks`, `block_exceptions`, `block_tasks`), uprawnienia i polityki RLS
„tylko własne wiersze”. Migracja `0002_categories.sql` dodaje tabelę kategorii i przypisuje do nich bloki:
kolory istniejących bloków zamienia na kategorie o nazwach kolorów (np. „Niebieski”), które możesz potem
zmienić ołówkiem w menu kalendarza (`supabase db push` uruchamia obie migracje po kolei).

### Krok 5. Uruchom aplikację

```bash
npm run dev
```

Otwórz <http://localhost:3000>, zarejestruj się (rejestracja jest otwarta) i przejdź do zakładki **Kalendarz**.
Profil w bazie zakłada się sam przy pierwszym wejściu (strefa czasowa domyślnie `Europe/Warsaw`).

### Lista kontrolna po pierwszym uruchomieniu

- [ ] Logowanie działa, po zalogowaniu widać zakładkę Kalendarz bez komunikatu o błędzie.
- [ ] Przeciągnięcie po pustym miejscu otwiera formularz „Nowy blok”, a po zapisie blok zostaje po odświeżeniu strony.
- [ ] W Supabase (**Table Editor → blocks**) nowy wiersz ma wypełnione `user_id` (ID użytkownika z Clerka, `user_...`).
- [ ] Blok powtarzany: przesunięcie jednego wystąpienia pyta „Tylko to / To i następne / Wszystkie”.
- [ ] Zadania: klik w blok → dodaj zadanie → licznik „0/1” widać na bloku.
- [ ] **Strefa czasowa:** otwórz kalendarz w przeglądarce ustawionej na inną strefę (np. w Chrome DevTools →
      **More tools → Sensors → Location → Tokyo**, albo zmień strefę systemu) i sprawdź, że godziny bloków
      są takie same jak wcześniej (kalendarz pokazuje czas ze strefy profilu, nie przeglądarki).
- [ ] Drugi użytkownik (inne konto) nie widzi bloków pierwszego.

---

## Polecenia npm

| Polecenie | Co robi |
| --- | --- |
| `npm run dev` | Serwer deweloperski na <http://localhost:3000>. |
| `npm run build` / `npm start` | Wersja produkcyjna: zbudowanie i uruchomienie. |
| `npm run lint` | Sprawdzenie kodu (ESLint). |
| `npm test` | Testy jednostkowe (Vitest, pliki `src/**/*.test.ts`). Nie potrzebują bazy ani kluczy. |
| `npm run test:db` | Test polityk RLS na lokalnym PostgreSQL (opis niżej). |
| `npm run test:e2e` | Test end-to-end w przeglądarce (Playwright, opis niżej). |

### `npm run test:db` – czego potrzebuje

Lokalny **PostgreSQL 16** (bez Dockera i bez Supabase CLI) oraz programy `psql`, `createdb`, `dropdb` w `PATH`.
Skrypt `scripts/test-db.sh` tworzy od zera bazę `rhytm_test`, nakłada „shim” udający Supabase
(`supabase/tests/00_shim.sql`), migracje i test `supabase/tests/rls.test.sql`.

Domyślne połączenie: `localhost:5432`, użytkownik `postgres`, hasło `postgres`. Inne ustawienia podasz zmiennymi:

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGPASSWORD=twoje-haslo TEST_DB_NAME=rhytm_test npm run test:db
```

### `npm run test:e2e` – czego potrzebuje

Przy pierwszym użyciu zainstaluj przeglądarkę: `npx playwright install chromium`.

Test potrzebuje działającej konfiguracji z kroków 1–4 oraz konta testowego w Clerku. Ustaw zmienne
(w `.env.local` albo w terminalu):

| Zmienna | Opis |
| --- | --- |
| `E2E_CLERK_USER_EMAIL` | E-mail istniejącego użytkownika testowego w Clerku. |
| `E2E_CLERK_USER_PASSWORD` | Jego hasło. |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` | Jak w kroku 2. |

Gdy którejś zmiennej brakuje, test jest **pomijany** (skipped) z listą brakujących nazw, a serwer nie startuje.
Gdy wszystkie są, Playwright sam uruchamia `npm run dev`.

---

## Struktura (najważniejsze miejsca)

- `src/app/(app)/kalendarz/actions.ts` – akcje serwera kalendarza (odczyt, zapis, zadania).
- `src/lib/calendar/` – logika kalendarza z testami: rozwijanie powtórzeń (`expand.ts`),
  planowanie edycji „tylko to / to i następne / wszystkie” (`plan-edit.ts`) i jej zapis (`execute.ts`).
- `src/components/calendar/` – kalendarz, formularz bloku, dialog zakresu, panel zadań.
- `supabase/migrations/` – schemat bazy i polityki RLS.
- `docs/superpowers/specs/` – specyfikacja projektu.
