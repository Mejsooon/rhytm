# Life Organizer — dokument projektowy

Data: 2026-11-13 · Status: zaakceptowany (2026-11-13)

## 1. Po co to jest

Mejson chce mieć w jednym miejscu wszystko, czego używa do organizacji życia, a czego nie znalazł razem w żadnym istniejącym programie: kalendarz bloków czasowych z zadaniami, osobny kalendarz treningów ze statystykami, habit tracker z heatmapą i sleep log.

Kolejność: **najpierw aplikacja dla niego samego**, testowana na co dzień; **później może komercyjnie (SaaS)**. Dlatego od pierwszego dnia są konta i dane przypisane do użytkownika, ale bez płatności i bez funkcji dla wielu osób naraz.

Cały kod pisze Claude. Mejson jest użytkownikiem i decyduje o produkcie.

### Co znaczy sukces
- Mejson używa aplikacji codziennie zamiast innych narzędzi do tych czterech rzeczy.
- Poranny wpis (nawyki + sen) na telefonie zajmuje kilkanaście sekund.
- Po miesiącu statystyki biegów i siłowni odpowiadają na jego pytania (km, tempo, postęp ciężarów) bez liczenia ręcznie.

### Cele
- Kalendarz główny z blokami czasowymi i zadaniami w blokach (jak Notion Calendar).
- Osobny kalendarz sportowy (bieg / siłownia) ze statystykami i heatmapami.
- Nawyki z elastycznym harmonogramem i heatmapą dziennego postępu.
- Sleep log.
- Działa na komputerze i wygodnie na telefonie (PWA).
- Konta użytkowników i pełne rozdzielenie danych, żeby przejście na SaaS nie wymagało przepisywania.

### Nie-cele (poza v1)
- Synchronizacja z Google Calendar (ani podgląd, ani zapis). Może kiedyś: podgląd tylko do odczytu.
- Przypomnienia i powiadomienia push.
- Zadania bez bloku („inbox”).
- Plany treningowe, timer przerw.
- Natywne aplikacje mobilne.
- Płatności, plany cenowe, współdzielenie, funkcje społecznościowe.
- Tryb offline (PWA ma dać się zainstalować, ale może wymagać sieci).

### Anty-cele (porażka, nawet jeśli „działa”)
- Wpisanie czegoś na telefonie jest wolniejsze niż w notatkach. Wtedy przestanie być używane.
- Dane jednego użytkownika widoczne dla innego.
- Kalendarz sportowy i główny mieszają się ze sobą.
- Dzień z nawykiem „3×/tydz.”, którego akurat nie zrobił, wygląda jak porażka.

## 2. Ograniczenia
- Jeden programista (Claude), jeden właściciel produktu (Mejson, początkujący programista, bez dużego budżetu): darmowe progi hostingu na start.
- Interfejs po polsku. Strefa czasowa użytkownika (domyślnie Europe/Warsaw), tydzień od poniedziałku, jednostki metryczne, format 24h.

## 3. Podejścia (rozważone)

| | A. Next.js + Supabase | B. FastAPI + React | C. No-code / szablony |
|---|---|---|---|
| Opis | Full-stack TypeScript, Supabase daje Postgres + logowanie + RLS | Backend w Pythonie, osobny frontend | Notion, Bubble itp. |
| Plusy | Najkrótsza droga do SaaS, jeden język, jeden hosting | Backend w znanym Mejsonowi Pythonie | Szybki start |
| Minusy | Backend nie w Pythonie | ~1,5–2× więcej pracy, własne logowanie, dwie usługi | Utknie na przeciąganiu bloków, powtórzeniach i własnych heatmapach; do wyrzucenia przy SaaS |

**Wybrane: A** (wybór Mejsona, zgodny z rekomendacją). Uzasadnienie: konta i rozdzielenie danych od razu, najmniej elementów do utrzymania. C odrzucone, bo nie spełnia wymagań kalendarza i przeczy celowi „później SaaS”.

### Stos (decyzje Claude'a)
- Next.js (App Router) + TypeScript, Tailwind CSS + **coss ui** (biblioteka komponentów Cal.com, zbudowana na Base UI, komponenty kopiowane do projektu). Decyzja Mejsona. Brakujące komponenty buduje się na Base UI w stylu coss ui.
- **Clerk**: rejestracja, logowanie (e-mail + hasło, Google), reset hasła, zarządzanie kontem. Decyzja Mejsona.
- Supabase: Postgres + Row Level Security na każdej tabeli z danymi użytkownika. Clerk podpięty jako zewnętrzny dostawca uwierzytelniania (third-party auth): Supabase ufa tokenowi sesji Clerka, a RLS porównuje `user_id` z `auth.jwt()->>'sub'`.
- Kalendarz: gotowa biblioteka z widokami dzień/tydzień/miesiąc i przeciąganiem (np. FullCalendar). Builder może wybrać inną, jeśli spełnia wymagania z sekcji 4.1.
- Powtarzanie: reguła zapisana jako struktura JSON (`freq`, `byWeekday`, `until`) i rozwijana własną, testowaną funkcją. Przy tych czterech opcjach biblioteka RRULE nie jest potrzebna. *[Claude, zmiana przy planowaniu]*
- Wykresy: lekka biblioteka (np. Recharts). Heatmapy: własny komponent siatki w stylu GitHuba.
- Hosting: Vercel + Supabase. PWA: manifest + ikona, instalacja na ekranie głównym.

## 4. Funkcje

Nawigacja: trzy zakładki: **Kalendarz**, **Sport**, **Nawyki**. Na komputerze menu boczne lub górne, na telefonie dolny pasek. Plus ustawienia (profil).

### 4.1 Kalendarz główny (decyzje Mejsona, chyba że oznaczono inaczej)
- Widok jak w Notion Calendar. Widoki: tydzień (domyślny na komputerze), dzień (domyślny na telefonie), miesiąc. *[Claude]*
- Tworzenie bloku: przeciągnięcie po pustym miejscu (na telefonie: przycisk „+” i formularz). Przeciąganie przesuwa blok, a złapanie za krawędź zmienia jego długość. *[Claude]*
- Blok: tytuł, kolor/kategoria, opcjonalna notatka. *[Claude]*
- **Klik w blok** otwiera panel z listą zadań tego bloku (dodaj, odhacz, usuń, edytuj). Na bloku w siatce widać licznik „zrobione/wszystkie”.
- **Powtarzanie** (Mejson): bloki mogą się powtarzać. **Każde powtórzenie ma własną, pustą listę zadań**, a nieodhaczone zadania nie przechodzą dalej.
  - Opcje: codziennie, dni robocze, wybrane dni tygodnia, co tydzień. Opcjonalna data końca. *[Claude]*
  - Edycja/przesunięcie/usunięcie powtórzenia pyta: „tylko to / to i następne / wszystkie”. *[Claude]*
  - Zadania należą do konkretnego wystąpienia (seria + data wystąpienia). Przy zmianie „to i następne” zadania już dodane do przyszłych wystąpień zostają przy nich, jeśli wystąpienie dalej istnieje. *[Claude]*
- Kalendarz główny jest **całkowicie osobny** od sportowego: osobne dane, nie pokazuje treningów i odwrotnie (Mejson).

### 4.2 Kalendarz sportowy
- Taki sam komponent kalendarza, osobne dane. Bloki mają typ: **Bieg** albo **Siłownia** (Mejson).
- Blok można dodać z wyprzedzeniem jako plan, a dane uzupełnić po treningu. Do statystyk liczą się tylko treningi z uzupełnionymi danymi. *[Claude]*
- Powtarzanie bloków sportowych: **nie w v1**. Zamiast tego jest opcja „duplikuj”. *[Claude]*

**Bieg** (pola od Mejsona):
- Wpisuje: dystans (km), czas (hh:mm:ss), ocenę trudności (skala 1–10 *[Claude]*), opcjonalną notatkę.
- Liczone automatycznie: tempo (min/km) i kcal.
- **Kcal:** wzór ACSM dla biegu: VO₂ = 3,5 + 0,2 × prędkość [m/min] (ml/kg/min), kcal ≈ VO₂ × waga [kg] × czas [min] / 1000 × 5. Waga pochodzi z profilu w chwili zapisu i jest przechowywana razem z biegiem, więc zmiana wagi nie przelicza starych biegów. *[Claude]* Uwaga: ten wzór nie używa wieku ani wzrostu. Profil i tak je zbiera, a wzór można później wymienić.

**Siłownia** (Mejson: długość treningu, ćwiczenia, śledzenie wzrostu ciężaru):
- Godzina startu i końca (długość z bloku), lista ćwiczeń, a w każdym ćwiczeniu serie: **ciężar (kg) × powtórzenia**. Opcjonalna notatka. *[Claude]*
- Biblioteka ćwiczeń użytkownika: nowa nazwa zapisuje się przy pierwszym użyciu, potem podpowiada się z listy (bez rozróżniania wielkości liter, żeby nie było duplikatów). *[Claude]*
- „Kopiuj z poprzedniego”: wstawia ćwiczenia i serie z ostatniego treningu siłowego. *[Claude]*

**Statystyki** (pod kalendarzem sportowym, Mejson):
- Biegi: kafelki dla okresu tydzień/miesiąc/rok: suma km, suma czasu, średnie tempo, suma kcal. Wykres km tygodniowo, wykres tempa w czasie, lista biegów z oceną i notatkami. *[układ: Claude]*
- Siłownia: wybór ćwiczenia, a potem wykres **najcięższej serii** z każdego treningu w czasie. Liczba treningów i suma czasu w okresie. *[Claude]*
- **Heatmapa biegów** i **heatmapa siłowni** (Mejson): siatka roczna w stylu GitHuba. Kolor przy biegach zależy od km danego dnia, przy siłowni od minut treningu. *[mapowanie: Claude]*

### 4.3 Nawyki
- Lista nawyków do odhaczania na dany dzień, z możliwością cofnięcia się do wcześniejszych dni (Mejson: odhaczanie, heatmapa dziennego postępu).
- **Harmonogram** (Mejson: musi być wybór):
  - codziennie,
  - wybrane dni tygodnia,
  - X razy w tygodniu (dowolne dni),
  - bez planu (odhacza, kiedy zrobi).
- **% dnia** *[Claude]*: (zrobione zaplanowane na ten dzień + odhaczone nawyki X/tydz. i bez planu) / (zaplanowane na ten dzień + odhaczone nawyki X/tydz. i bez planu). Nawyki X/tydz. i bez planu mogą tylko podnieść wynik. Dzień bez żadnego zaplanowanego ani odhaczonego nawyku jest pusty (szary), a nie 0%.
- Nawyki X/tydz. pokazują postęp tygodnia („2/3”).
- Heatmapa ogólna (kolor = % dnia) oraz po kliknięciu nawyku jego własna heatmapa i seria dni z rzędu. *[Claude]*
- Nawyk można zarchiwizować: znika z listy, a historia zostaje. *[Claude]*

### 4.4 Sleep log (pod nawykami)
- Wpis na dzień pobudki: godzina zaśnięcia, godzina pobudki (czas liczy się sam, także przez północ), samopoczucie po przebudzeniu 1–5, opcjonalna notatka. *[skala i notatka: Claude]*
- Jeden wpis na dzień (edytowalny).
- Wykres godzin snu z ostatnich 7/30 dni, średni czas snu, średnie samopoczucie. *[Claude]*

### 4.5 Konta i profil
- **Rejestracja otwarta** (decyzja Mejsona) i logowanie przez Clerk: e-mail + hasło oraz Google *[Google: Claude]*. Reset hasła i weryfikacja e-maila po stronie Clerka.
- Ekrany Clerka (`<SignIn/>`, `<SignUp/>`, `<UserProfile/>`) ostylowane tokenami Rhytm.
- Profil w naszej bazie zakładany przy pierwszym wejściu do aplikacji (upsert po `user_id` z Clerka).
- Profil: waga, wzrost, wiek (data urodzenia), płeć, strefa czasowa.
- Każda tabela ma `user_id text` (ID użytkownika Clerka, domyślnie `auth.jwt()->>'sub'`) i politykę RLS „tylko własne wiersze”.

## 5. Model danych (szkic, builder może dopracować)
- `profiles` (user_id, weight_kg, height_cm, birth_date, sex, timezone)
- `blocks` (id, user_id, title, color, note, start_local, duration_min, timezone, recurrence jsonb NULL)
- `block_exceptions` (block_id, occurrence_date, kind: cancelled | modified, new_start_at, new_end_at, new_title…)
- `block_tasks` (id, block_id, occurrence_date, title, done, position)
- `sport_sessions` (id, user_id, type: run | gym, start_at, end_at, note, completed bool)
- `runs` (session_id, distance_km, duration_s, difficulty 1–10, weight_kg_snapshot, kcal)
- `exercises` (id, user_id, name, UNIQUE(user_id, lower(name)))
- `gym_sets` (id, session_id, exercise_id, set_no, weight_kg, reps)
- `habits` (id, user_id, name, schedule_type, weekdays int[], times_per_week, archived_at)
- `habit_checks` (habit_id, date, UNIQUE)
- `sleep_logs` (user_id, date, slept_at, woke_at, feeling 1–5, note, UNIQUE(user_id, date))

Daty „dnia” (nawyki, sen, heatmapy) liczone w strefie czasowej użytkownika.

## 5a. Doprecyzowania po recenzji *[Claude]*
- Zmiana harmonogramu nawyku nie zmienia oceny przeszłych dni (harmonogram wersjonowany od daty zmiany).
- Seria dla nawyków X/tydz. liczona w tygodniach, a nie w dniach.
- Bloki cykliczne trzymane w czasie lokalnym użytkownika: zmiana czasu letni/zimowy nie przesuwa godziny.
- Rejestracja otwarta przez Clerk (zmiana po recenzji, decyzja Mejsona). Ochronę przed botami i limity prób logowania daje Clerk.

## 6. Pozostawione builderowi
- Dokładny układ ekranów i stylistyka (w ramach coss ui, czytelnie na telefonie).
- Wybór konkretnych bibliotek kalendarza i wykresów, jeśli spełniają wymagania.
- Kolejność budowy. Sugestia: konta → kalendarz główny → nawyki + sen (codzienne użycie na telefonie) → sport + statystyki.
- Testy: logika powtórzeń, % dnia nawyków, tempo/kcal, czas snu przez północ — testy jednostkowe obowiązkowe.
