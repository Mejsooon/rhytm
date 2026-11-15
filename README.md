# Rhytm

Aplikacja do organizacji życia: kalendarz bloków czasu z zadaniami (etap 1), nawyki, sen i ekran „Dziś” (etap 2), a dalej kalendarz sportowy.

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
`NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` (i `..._SIGN_UP_...`) = `/dzis`: po zalogowaniu aplikacja
otwiera ekran „Dziś”. Jeśli masz starszy `.env.local` z `/kalendarz`, zmień te dwie wartości.

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
  `supabase/migrations/0002_categories.sql` (kategorie bloków; uruchom ją po `0001`), a na końcu
  `supabase/migrations/0003_habits_sleep.sql` (nawyki i sen; uruchom ją po `0002`). Kolejność: `0001` → `0002` → `0003`.
- **Supabase CLI:** `supabase link --project-ref <id-projektu>`, a potem `supabase db push`.

Migracja tworzy tabele (`profiles`, `blocks`, `block_exceptions`, `block_tasks`), uprawnienia i polityki RLS
„tylko własne wiersze”. Migracja `0002_categories.sql` dodaje tabelę kategorii i przypisuje do nich bloki:
kolory istniejących bloków zamienia na kategorie o nazwach kolorów (np. „Niebieski”), które możesz potem
zmienić ołówkiem w menu kalendarza (`supabase db push` uruchamia wszystkie migracje po kolei).

Migracja `0003_habits_sleep.sql` (etap 2) tworzy tabele nawyków (wersje harmonogramu i odhaczenia) oraz
dziennik snu, każdą z RLS „tylko własne wiersze”, i dodaje do `profiles` kolumnę `sleep_goal_min` (cel snu,
domyślnie 8 h). Niczego nie usuwa, więc **uruchom ją przed wdrożeniem kodu etapu 2**, a stary kod dalej działa.
Na hostowanym projekcie Supabase jest już zastosowana; ten opis jest dla świeżych instalacji.

> **Uwaga przy aktualizacji istniejącej instalacji:** migrację `0002_categories.sql` trzeba wdrożyć razem z tym
> kodem. Stary kod przestaje działać po `0002` (migracja usuwa kolumnę `color`), a nowy kod bez `0002` psuje cały
> obszar aplikacji (`ensureProfile` → `ensureCategories` czyta tabelę `categories`). Praktycznie: uruchom `0002`
> w SQL Editor tuż przed wdrożeniem nowego kodu albo zaraz po nim i w tym czasie nie zostawiaj działającej starej
> wersji. Przerwa potrwa chwilę, bo migracja jest szybka.

### Krok 5. Uruchom aplikację

```bash
npm run dev
```

Otwórz <http://localhost:3000>, zarejestruj się (rejestracja jest otwarta). Po zalogowaniu stroną startową jest
**Dziś** (`/dzis`): plan dnia, nawyki do odhaczenia i ostatnia noc. Dalej są zakładki **Kalendarz** (`/kalendarz`)
i **Nawyki i sen** (`/nawyki`). Profil w bazie zakłada się sam przy pierwszym wejściu (strefa czasowa domyślnie
`Europe/Warsaw`, cel snu 8:00).

Cel snu (linia celu na wykresie snu, od 4 do 12 godzin) ustawisz w **Ustawieniach** w polu „Cel snu”.

### Lista kontrolna po pierwszym uruchomieniu

- [ ] Logowanie działa, po zalogowaniu otwiera się ekran „Dziś” (`/dzis`) bez komunikatu o błędzie.
- [ ] Przeciągnięcie po pustym miejscu otwiera formularz „Nowy blok”, a po zapisie blok zostaje po odświeżeniu strony.
- [ ] W Supabase (**Table Editor → blocks**) nowy wiersz ma wypełnione `user_id` (ID użytkownika z Clerka, `user_...`).
- [ ] Blok powtarzany: przesunięcie jednego wystąpienia pyta „Tylko to / To i następne / Wszystkie”.
- [ ] Zadania: klik w blok → dodaj zadanie → licznik „0/1” widać na bloku.
- [ ] **Strefa czasowa:** otwórz kalendarz w przeglądarce ustawionej na inną strefę (np. w Chrome DevTools →
      **More tools → Sensors → Location → Tokyo**, albo zmień strefę systemu) i sprawdź, że godziny bloków
      są takie same jak wcześniej (kalendarz pokazuje czas ze strefy profilu, nie przeglądarki).
- [ ] Nawyki: na `/nawyki` utwórz nawyk, odhacz go na `/dzis` i sprawdź, że na `/nawyki` jest odhaczony.
- [ ] Sen: zapisz noc (np. 23:40 → 07:10 daje „7 h 30”) i sprawdź ją na `/dzis`; w Ustawieniach zmień „Cel snu”.
- [ ] Drugi użytkownik (inne konto) nie widzi bloków pierwszego.

---

## Wdrożenie na Vercel i przypomnienia push

Przypomnienia o nawykach działają tak: co minutę `pg_cron` w Supabase wybiera nawyki, którym wypada przypomnienie,
i wysyła je (`pg_net`) do endpointu `/api/cron/przypomnienia` na Vercelu, a ten rozsyła powiadomienia web push.

1. **Wygeneruj klucze** (wyniki zachowaj tylko w menedżerze haseł, Vercelu i `.env.local`):
   - `npx web-push generate-vapid-keys` daje klucz publiczny (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`) i prywatny (`VAPID_PRIVATE_KEY`);
   - `openssl rand -hex 32` daje `CRON_SECRET`.
2. **Vercel:** Add New → Project → zaimportuj repozytorium z GitHuba. W **Environment Variables** wpisz wszystkie
   zmienne z `.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, zmienne Clerka
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, adresy logowania, a oba `..._FALLBACK_REDIRECT_URL` =
   `/dzis`) oraz `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` z Twoim adresem
   e-mail) i `CRON_SECRET`. Potem **Deploy**.
3. **Clerk:** jeśli instancja tego wymaga (np. produkcyjna), dodaj domenę z Vercela w Clerk Dashboard →
   **Domains**.
4. **Supabase** (SQL Editor / Dashboard), po kolei:
   1. zastosuj migrację `supabase/migrations/0004_habit_reminders.sql` (wklej plik i **Run**; może być już zastosowana);
   2. **Database → Extensions:** włącz `pg_cron` i `pg_net`;
   3. utwórz sekrety Vault (wartości wpisz sam; `rhytm_cron_secret` = ta sama wartość co `CRON_SECRET`, adres bez `/` na końcu):
      ```sql
      select vault.create_secret('<CRON_SECRET>', 'rhytm_cron_secret');
      select vault.create_secret('https://<adres-na-vercelu>', 'rhytm_app_url');
      ```
   4. uruchom `supabase/setup/przypomnienia-cron.sql` (można go uruchomić ponownie, np. po zmianie harmonogramu).
5. **Na telefonie:** otwórz adres aplikacji. Na iPhonie (iOS 16.4+) powiadomienia działają dopiero po dodaniu
   aplikacji do ekranu głównego: Udostępnij → **Do ekranu początkowego**, i otwarciu jej stamtąd. Wejdź w
   Ustawienia → **Włącz powiadomienia** i zezwól. Ustaw nawykowi godzinę przypomnienia za 2–3 minuty i poczekaj.
6. **Diagnostyka** (SQL Editor):
   ```sql
   select * from cron.job_run_details order by start_time desc limit 5;
   select * from net._http_response order by created desc limit 5;
   ```
   Pierwsze pokazuje, czy job działa i czy kończy się błędem; drugie, jaką odpowiedź zwrócił endpoint
   (`{"sent":…,"failed":…,"removed":…}`, kod 401 = niezgodny `CRON_SECRET` w Vault i na Vercelu).

---

## Polecenia npm

| Polecenie | Co robi |
| --- | --- |
| `npm run dev` | Serwer deweloperski na <http://localhost:3000>. |
| `npm run build` / `npm start` | Wersja produkcyjna: zbudowanie i uruchomienie. |
| `npm run lint` | Sprawdzenie kodu (ESLint). |
| `npm test` | Testy jednostkowe (Vitest, pliki `src/**/*.test.ts`). Nie potrzebują bazy ani kluczy. |
| `npm run test:db` | Test polityk RLS na lokalnym PostgreSQL (opis niżej). |
| `npm run test:e2e` | Test end-to-end w przeglądarce (Playwright: kalendarz, nawyki, sen i ekran „Dziś”; opis niżej). |

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

Test nawyków (`e2e/habits.spec.ts`) tworzy nawyk z unikalną nazwą i zapisuje sen z dzisiejszej nocy (23:40–07:10).
Na koniec archiwizuje nawyk i usuwa swój wpis snu, więc możesz go powtarzać.

> **Uwaga:** jeśli konto testowe ma już wpis snu z dzisiejszej nocy, test go **czasowo zastępuje**: odczytuje
> (godziny, samopoczucie, notatka), usuwa, a na końcu przywraca. Awaria w trakcie (np. zamknięty terminal) może
> zostawić wpis testowy. Dlatego użyj **osobnego konta testowego**, a nie swojego głównego.

Gdy którejś zmiennej brakuje, test jest **pomijany** (skipped) z listą brakujących nazw, a serwer nie startuje.
Gdy wszystkie są, Playwright sam uruchamia `npm run dev`.

---

## Struktura (najważniejsze miejsca)

- `src/app/(app)/kalendarz/actions.ts` – akcje serwera kalendarza (odczyt, zapis, zadania).
- `src/lib/calendar/` – logika kalendarza z testami: rozwijanie powtórzeń (`expand.ts`),
  planowanie edycji „tylko to / to i następne / wszystkie” (`plan-edit.ts`) i jej zapis (`execute.ts`).
- `src/components/calendar/` – kalendarz, formularz bloku, dialog zakresu, panel zadań.
- `src/lib/habits/`, `src/lib/sleep/` – logika nawyków (harmonogramy, serie, wynik dnia) i snu (czas przez północ
  i zmianę czasu, słupki wykresu) z testami.
- `src/components/habits/`, `src/components/sleep/`, `src/components/today/` – ekrany `/nawyki` i `/dzis`.
- `e2e/` – testy end-to-end (Playwright).
- `supabase/migrations/` – schemat bazy i polityki RLS.
- `supabase/setup/` – jednorazowa konfiguracja uruchamiana ręcznie w SQL Editorze (cron przypomnień).
- `docs/superpowers/specs/` – specyfikacja projektu.
