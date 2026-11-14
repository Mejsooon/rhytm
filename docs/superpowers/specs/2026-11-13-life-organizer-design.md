# Life Organizer — dokument projektowy

Data: 2026-11-13 · Status: zaakceptowany (2026-11-13) · Aktualizacja: 2026-11-14 (wersja 2, po projekcie ekranów; zmiany w sekcji 9)

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
- Powiadomienia push poza przypomnieniami o nawykach (np. o blokach z kalendarza).
- Zadania bez bloku („inbox”, panel „Do zaplanowania”).
- Plany treningowe (np. pod półmaraton), minutnik przerwy na siłowni.
- Natywne aplikacje mobilne.
- Płatności, plany cenowe, współdzielenie, funkcje społecznościowe.
- Tryb offline (PWA ma dać się zainstalować, ale może wymagać sieci).

### Anty-cele (porażka, nawet jeśli „działa”)
- Wpisanie czegoś na telefonie jest wolniejsze niż w notatkach. Wtedy przestanie być używane.
- Dane jednego użytkownika widoczne dla innego.
- Kalendarz sportowy i główny mieszają się ze sobą: trening da się edytować w dwóch miejscach albo dane sportowe trafiają do bloków kalendarza głównego. (Wersja 2: treningi są **widoczne** w kalendarzu głównym tylko do podglądu, patrz 4.1.)
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

Nawigacja: cztery pozycje: **Dziś** (ekran startowy), **Kalendarz**, **Sport**, **Nawyki i sen**. Na komputerze menu boczne, na telefonie dolny pasek. Plus ustawienia (profil). *[wersja 2]*

Wygląd: „cichy styl” w duchu Notion/Untitled UI (jasne tło, szare ikony, kolor tylko w kropkach kategorii i wykresach). Wzorem są ekrany na płótnie „Rhytm — ekrany aplikacji” (sekcja 7). Szerokość treści zależy od rodzaju ekranu: kalendarze na całą szerokość, Sport i Dziś do 1200 px, Nawyki i sen do 880 px (wyśrodkowane). *[wersja 2]*

### 4.1 Kalendarz główny (decyzje Mejsona, chyba że oznaczono inaczej)
- Widok jak w Notion Calendar. Widoki: tydzień (domyślny na komputerze), dzień (domyślny na telefonie), miesiąc. *[Claude]*
- Tworzenie bloku: przeciągnięcie po pustym miejscu (na telefonie: przycisk „+” i formularz). Przeciąganie przesuwa blok, a złapanie za krawędź zmienia jego długość. *[Claude]*
- Blok: tytuł, kategoria, opcjonalna notatka. *[Claude]*
- **Kategorie** *[wersja 2]*: użytkownik ma własną listę kategorii (nazwa + kolor z palety 8 kolorów). W menu bocznym każda ma kropkę w swoim kolorze i licznik bloków. Klik w kategorię ukrywa lub pokazuje jej bloki (pełna kropka = widoczna, pusty pierścień = ukryta). Pod listą jest „+ Dodaj kategorię”, które otwiera okno z nazwą, wyborem koloru (kolory zajęte przez inne kategorie są wyblakłe, ale można je wybrać) i podglądem. Nad kalendarzem są też zakładki-filtry: Wszystkie + po jednej na kategorię.
- **Mini kalendarz** w menu bocznym *[wersja 2]*: bieżący miesiąc z numerami tygodni, dziś w ciemnym kółku. W widoku tygodnia podświetla cały tydzień, w widoku dnia wybrany dzień. Klik w dzień przechodzi do niego.
- **Przełącznik widoków** Dzień / Tydzień / Miesiąc nad kalendarzem. Kalendarz zajmuje całą szerokość, a szczegóły bloku (zadania, notatka) pokazują się dopiero po kliknięciu, w panelu nad kalendarzem. *[wersja 2]*
- **Klik w blok** otwiera panel z listą zadań tego bloku (dodaj, odhacz, usuń, edytuj). Na bloku w siatce widać licznik „zrobione/wszystkie”.
- **Powtarzanie** (Mejson): bloki mogą się powtarzać. **Każde powtórzenie ma własną, pustą listę zadań**, a nieodhaczone zadania nie przechodzą dalej.
  - Opcje: codziennie, dni robocze, wybrane dni tygodnia, co tydzień. Opcjonalna data końca. *[Claude]*
  - Edycja/przesunięcie/usunięcie powtórzenia pyta: „tylko to / to i następne / wszystkie”. *[Claude]*
  - Zadania należą do konkretnego wystąpienia (seria + data wystąpienia). Przy zmianie „to i następne” zadania już dodane do przyszłych wystąpień zostają przy nich, jeśli wystąpienie dalej istnieje. *[Claude]*
- Kalendarz główny i sportowy mają **osobne dane** (Mejson). *[wersja 2, decyzja Mejsona 2026-11-14]* Treningi są jednak **widoczne** w kalendarzu głównym jako bloki tylko do podglądu, w kategorii „Sport” (pomarańczowa kropka), którą można ukryć jak każdą inną. Zaplanowane treningi mają białe tło i przerywaną ramkę, wykonane pomarańczowe tło. Klik w trening otwiera podgląd z linkiem do zakładki Sport. Tworzy się je i edytuje tylko w zakładce Sport. Kategoria „Sport” jest systemowa: nie da się jej usunąć ani zmienić jej koloru.

### 4.2 Kalendarz sportowy
- Taki sam komponent kalendarza, osobne dane. Bloki mają typ: **Bieg** albo **Siłownia** (Mejson).
- Blok można dodać z wyprzedzeniem jako plan, a dane uzupełnić po treningu. Do statystyk liczą się tylko treningi z uzupełnionymi danymi. *[Claude]*
- Powtarzanie bloków sportowych: **nie w v1**. Zamiast tego jest opcja „duplikuj”. *[Claude]*
- Widoki kalendarza sportowego: **Tydzień** i **Miesiąc** (przełącznik w nagłówku). Tytuł i podsumowanie („1 z 3 biegów · 1 z 2 treningów”) zmieniają się z widokiem. *[wersja 2, Mejson]*
- Menu boczne Sportu *[wersja 2]*: mini kalendarz (jak w 4.1, dni z treningiem mają kropkę: jaśniejsza = bieg, ciemniejsza = siłownia) i sekcja **Aktywności** (Bieg, Siłownia z licznikiem w miesiącu, „+ Dodaj typ” na przyszłość). Klik w aktywność ukrywa ją w siatce tygodnia i miesiąca oraz w kropkach mini kalendarza.
- **Tygodniowy cel km** *[wersja 2, Mejson]*: ustawiany w ustawieniach (domyślnie brak). Postęp pokazuje ekran Dziś. Do celu liczą się tylko biegi z uzupełnionymi danymi.

**Bieg** (pola od Mejsona):
- Wpisuje: dystans (km), czas (hh:mm:ss), ocenę trudności (skala 1–10 *[Claude]*), opcjonalną notatkę.
- Liczone automatycznie: tempo (min/km) i kcal.
- **Kcal:** wzór ACSM dla biegu: VO₂ = 3,5 + 0,2 × prędkość [m/min] (ml/kg/min), kcal ≈ VO₂ × waga [kg] × czas [min] / 1000 × 5. Waga pochodzi z profilu w chwili zapisu i jest przechowywana razem z biegiem, więc zmiana wagi nie przelicza starych biegów. *[Claude]* Uwaga: ten wzór nie używa wieku ani wzrostu. Profil i tak je zbiera, a wzór można później wymienić.

**Siłownia** (Mejson: długość treningu, ćwiczenia, śledzenie wzrostu ciężaru):
- Godzina startu i końca (długość z bloku), lista ćwiczeń, a w każdym ćwiczeniu serie: **ciężar (kg) × powtórzenia**. Opcjonalna notatka. *[Claude]*
- Biblioteka ćwiczeń użytkownika: nowa nazwa zapisuje się przy pierwszym użyciu, potem podpowiada się z listy (bez rozróżniania wielkości liter, żeby nie było duplikatów). *[Claude]*
- „Kopiuj z poprzedniego”: wstawia ćwiczenia i serie z ostatniego treningu siłowego. *[Claude]*
- **Szablony treningów** *[wersja 2, Mejson: w v1]*: np. Push / Pull / Nogi. Szablon to nazwa + lista ćwiczeń z liczbą serii. Trening z szablonu startuje z ciężarami i powtórzeniami z ostatniego wykonania danego ćwiczenia. Szablon tworzy się przyciskiem „Zapisz jako szablon” na ekranie treningu.
- Ekran zapisu treningu *[wersja 2]*: każde ćwiczenie ma tabelę serii (nr, „poprzednio”, kg, powtórzenia, przycisk „zrobione”), „+ Dodaj serię”, „+ Dodaj ćwiczenie”. Z boku podsumowanie: serie zrobione / wszystkie, objętość (suma kg × powtórzenia zrobionych serii), czas, liczba rekordów. Seria cięższa niż dotychczasowa najcięższa w tym ćwiczeniu dostaje plakietkę „Rekord”.
- **Szczegóły ćwiczenia** *[wersja 2]*: rekord (ciężar + data), szacowany 1RM ze wzoru Epleya (ciężar × (1 + powtórzenia / 30), z najlepszej serii), liczba treningów, postęp od pierwszego treningu. Wykres najcięższej serii z przełącznikiem 3 miesiące / pół roku / rok / wszystko i tabela historii serii.
- Zapis biegu odbywa się w oknie *[wersja 2]*: data, start, dystans, czas, tempo i kcal liczone na żywo, trudność 1–10, notatka, pole „Pokaż w kalendarzu jako blok” (domyślnie włączone).

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
- Heatmapa jest pod listą dzisiejszych nawyków, na całą szerokość kolumny, z przełącznikiem **Miesiąc / 3 miesiące / Pół roku / Rok** (domyślnie pół roku). Średnia i najdłuższa seria pod heatmapą dotyczą wybranego zakresu. Przy zakresie „Miesiąc” zamiast siatki jest zwykły kalendarz miesiąca z kolorem dnia. *[wersja 2, Mejson]*
- Okno „Nowy nawyk” *[wersja 2]*: nazwa, harmonogram (cztery opcje jako przełącznik; przy „wybrane dni” przyciski Pn–Nd, przy „X w tygodniu” licznik 1–7), pod spodem jedno zdanie, jak nawyk liczy się do % dnia, oraz podgląd najbliższych 2 tygodni.
- **Przypomnienia** *[wersja 2, Mejson: w v1]*: opcjonalna godzina przypomnienia dla nawyku. Powiadomienie push przez PWA (service worker + Web Push, wysyłka z zaplanowanego zadania po stronie serwera). Przypomnienie nie przychodzi, jeśli nawyk na dziś jest już odhaczony albo dziś nie jest zaplanowany. Na iPhonie działa tylko po dodaniu aplikacji do ekranu głównego (iOS 16.4+); aplikacja mówi to przy włączaniu przypomnień.
- Nawyk można zarchiwizować: znika z listy, a historia zostaje. *[Claude]*

### 4.4 Sleep log (pod nawykami)
- Wpis na dzień pobudki: godzina zaśnięcia, godzina pobudki (czas liczy się sam, także przez północ), samopoczucie po przebudzeniu 1–5, opcjonalna notatka. *[skala i notatka: Claude]*
- Jeden wpis na dzień (edytowalny).
- Wykres słupkowy godzin snu z przełącznikiem **Miesiąc / 3 miesiące / Pół roku / Rok**: przy miesiącu słupek = noc, przy 3 miesiącach i pół roku = średnia tygodnia, przy roku = średnia miesiąca. Pozioma przerywana linia celu. Pod wykresem: średni czas snu, średnia godzina zaśnięcia, średnie samopoczucie w zakresie. Wykres jest pod formularzem wpisu. *[wersja 2; wzór: Fitbit, Oura, Pillow]*
- **Cel snu** *[wersja 2, Mejson]*: domyślnie 8 h, zmieniany w ustawieniach. Słupki, w których cel został osiągnięty, są o odcień ciemniejsze.

### 4.5 Konta i profil
- **Rejestracja otwarta** (decyzja Mejsona) i logowanie przez Clerk: e-mail + hasło oraz Google *[Google: Claude]*. Reset hasła i weryfikacja e-maila po stronie Clerka.
- Ekrany Clerka (`<SignIn/>`, `<SignUp/>`, `<UserProfile/>`) ostylowane tokenami Rhytm.
- Profil w naszej bazie zakładany przy pierwszym wejściu do aplikacji (upsert po `user_id` z Clerka).
- Profil: imię (wyświetlane), waga, wzrost, wiek (data urodzenia), płeć, strefa czasowa, cel snu, tygodniowy cel km.
- **Pierwsze kroki (onboarding)** po rejestracji, 3 kroki z paskiem postępu *[wersja 2]*: (1) imię, waga (do kcal), strefa czasowa (wykryta automatycznie); (2) wybór startowych kategorii z gotowej listy; (3) wybór startowych nawyków z podpowiedzi (krok można pominąć). Wzrost, wiek i płeć są opcjonalne i uzupełnia się je w ustawieniach. Tydzień zawsze zaczyna się w poniedziałek (sekcja 2); wybór niedzieli widoczny na projekcie ekranu nie wchodzi do v1.
- **Stany puste** *[wersja 2]*: każdy ekran u nowego użytkownika ma krótki opis i przycisk pierwszej akcji. Ekran Dziś pokazuje listę „Pierwsze kroki” (pierwszy blok, nawyk, trening, wpis snu) z postępem 0–4.
- Każda tabela ma `user_id text` (ID użytkownika Clerka, domyślnie `auth.jwt()->>'sub'`) i politykę RLS „tylko własne wiersze”.

### 4.6 Dziś (ekran startowy) *[wersja 2]*
- Pierwszy ekran po zalogowaniu. Nagłówek z powitaniem i datą, pole szybkiego dodawania (4.7).
- Pasek podsumowania: zadania (zrobione z wszystkich dzisiejszych), nawyki (zrobione z zaplanowanych), sen ostatniej nocy (czas + samopoczucie), biegi w tym tygodniu względem celu km. Każde z cienkim paskiem postępu.
- Lewa kolumna **Plan dnia**: dzisiejsze bloki w kolejności godzin, z listami zadań do odhaczenia. Trwający blok ma oznaczenie „Teraz”.
- Prawa kolumna: **Nawyki** do odhaczenia, **Sen** (ostatnia noc + mini wykres 7 nocy z linią celu, link do edycji), **Sport** (postęp celu km, najbliższy trening, przyciski „+ Bieg” / „+ Trening”), **Wniosek tygodnia** (4.8).
- Budowany w etapie z nawykami i snem w wersji bez części sportowej. Część sportowa dochodzi w etapie sportu (decyzja Mejsona).

### 4.7 Szybkie dodawanie *[wersja 2, Mejson: w v1]*
- Pole na ekranie Dziś i skrót **Ctrl K** (Cmd K na Macu) z każdego ekranu.
- Rozpoznaje proste polecenia po polsku, bez AI, regułami: „bieg 10 km jutro 18:00”, „siłownia push pt 17:00”, „sen 23:40–7:10”, „blok nauka matma jutro 8–10”, „nawyk woda” (odhacza). Przed zapisem pokazuje, co zrozumiało (typ, data, godzina, wartości), i pozwala poprawić. Czego nie rozpozna, proponuje otworzyć zwykły formularz z wpisanym tekstem jako tytułem.

### 4.8 Wniosek tygodnia *[wersja 2, Mejson: w v1]*
- Jedna karta na ekranie Dziś z jednym zdaniem, które łączy dane z dwóch modułów, np. „Po nocach powyżej 7 h robisz średnio 92% nawyków, po krótszych 68%”, „W tygodniach z 3 treningami robisz 90% nawyków”, „Po nocach powyżej 7 h biegasz średnio o 0:12/km szybciej”.
- Liczony raz w tygodniu z ostatnich 30 dni, prostymi średnimi w dwóch grupach. Pokazywany tylko, gdy każda grupa ma co najmniej 7 dni danych, a różnica jest wyraźna (co najmniej 10 punktów procentowych albo 0:10/km). Inaczej karta się nie pokazuje. Pod zdaniem zawsze jest informacja, z jakiego okresu pochodzą dane.

## 5. Model danych (szkic, builder może dopracować)
- `profiles` (user_id, display_name, weight_kg, height_cm, birth_date, sex, timezone, sleep_goal_min DEFAULT 480, weekly_km_goal NULL, onboarded_at)
- `categories` (id, user_id, name, color, position, is_system) *[wersja 2; „Sport” jako is_system]*
- `blocks` (id, user_id, title, category_id, note, start_local, duration_min, timezone, recurrence jsonb NULL) *[wersja 2: category_id zamiast samego koloru]*
- `block_exceptions` (block_id, occurrence_date, kind: cancelled | modified, new_start_at, new_end_at, new_title…)
- `block_tasks` (id, block_id, occurrence_date, title, done, position)
- `sport_sessions` (id, user_id, type: run | gym, start_at, end_at, note, completed bool)
- `runs` (session_id, distance_km, duration_s, difficulty 1–10, weight_kg_snapshot, kcal)
- `exercises` (id, user_id, name, UNIQUE(user_id, lower(name)))
- `gym_sets` (id, session_id, exercise_id, set_no, weight_kg, reps, done)
- `workout_templates` (id, user_id, name) i `workout_template_items` (template_id, exercise_id, position, sets_count) *[wersja 2]*
- `habits` (id, user_id, name, schedule_type, weekdays int[], times_per_week, remind_at time NULL, archived_at)
- `push_subscriptions` (id, user_id, endpoint, keys jsonb, created_at) *[wersja 2]*
- `habit_checks` (habit_id, date, UNIQUE)
- `sleep_logs` (user_id, date, slept_at, woke_at, feeling 1–5, note, UNIQUE(user_id, date))

Daty „dnia” (nawyki, sen, heatmapy) liczone w strefie czasowej użytkownika.

## 5a. Doprecyzowania po recenzji *[Claude]*
- Zmiana harmonogramu nawyku nie zmienia oceny przeszłych dni (harmonogram wersjonowany od daty zmiany).
- Seria dla nawyków X/tydz. liczona w tygodniach, a nie w dniach.
- Bloki cykliczne trzymane w czasie lokalnym użytkownika: zmiana czasu letni/zimowy nie przesuwa godziny.
- Rejestracja otwarta przez Clerk (zmiana po recenzji, decyzja Mejsona). Ochronę przed botami i limity prób logowania daje Clerk.

## 6. Pozostawione builderowi
- Dopasowanie projektu z płótna (sekcja 7) do komponentów coss ui i do telefonu.
- Wybór konkretnych bibliotek kalendarza i wykresów, jeśli spełniają wymagania.
- Kolejność budowy: patrz sekcja 8.
- Testy: logika powtórzeń, % dnia nawyków, tempo/kcal, czas snu przez północ, parser szybkiego dodawania, 1RM i rekordy, wnioski tygodnia (progi z 4.8) — testy jednostkowe obowiązkowe.

## 7. Projekt ekranów *[wersja 2]*
Płótno „Rhytm — ekrany aplikacji” (artefakt Claude, „cichy styl”). Ekrany:

| Obszar | Ekrany |
|---|---|
| Start | Dziś · ekran startowy |
| Kalendarz | widok tygodnia (główny), widok miesiąca, widok dnia, okno „Nowy blok + zakres”, okno „Nowa kategoria” |
| Sport | widok tygodnia, widok miesiąca, okno „Nowy bieg”, trening siłowy, szczegóły ćwiczenia |
| Nawyki i sen | ekran główny (wąska kolumna), okno „Nowy nawyk” |
| Konto | logowanie, rejestracja, pierwsze kroki (3 kroki), ustawienia, nowe konto · stany puste |

Brakuje jeszcze: wersji na telefon (Dziś, kalendarz dnia, zapis serii na siłowni), okna szybkiego dodawania (4.7) i szczegółów pojedynczego nawyku. Projektuje się je przed etapem, który ich potrzebuje.

## 8. Etapy *[wersja 2]*
1. **Etap 1: fundament + kalendarz główny** (zrobione: PR #1 i poprawka odczytu kalendarza PR #2).
2. **Etap 1b: kalendarz w cichym stylu**: nowy wygląd całej aplikacji (menu boczne, kolory, typografia), kategorie (tabela, okno dodawania, filtr w menu, zakładki), mini kalendarz, przełącznik Dzień/Tydzień/Miesiąc, panel bloku po kliknięciu.
3. **Etap 2: nawyki + sen + Dziś (bez sportu)**: nawyki z harmonogramami, heatmapa z zakresami, sleep log z wykresem i celem snu, ekran Dziś (plan dnia, nawyki, sen), przypomnienia push o nawykach.
4. **Etap 3: sport**: biegi, siłownia z szablonami i rekordami, szczegóły ćwiczenia, statystyki i heatmapy, widok tydzień/miesiąc, filtr aktywności, cel km, treningi jako podgląd w kalendarzu głównym, część sportowa ekranu Dziś.
5. **Etap 4: całość**: rejestracja z pierwszymi krokami, stany puste, szybkie dodawanie Ctrl K, wniosek tygodnia, dopracowanie wersji na telefon.

Poza v1 (później): minutnik przerwy, plany treningowe, panel „Do zaplanowania”, synchronizacja z Google Calendar, tryb offline.

## 9. Historia zmian
- **2026-11-14, wersja 2** (po projektowaniu ekranów z Mejsonem): cichy styl i mapa ekranów (7); ekran Dziś (4.6); kategorie z oknem dodawania, mini kalendarz i przełącznik widoków (4.1); treningi widoczne w kalendarzu głównym tylko do podglądu, dane dalej osobno (4.1, anty-cele); Sport: widok miesiąca, filtr aktywności, szablony treningów, rekordy, szczegóły ćwiczenia z 1RM, tygodniowy cel km (4.2); nawyki: heatmapa z zakresami i widokiem kalendarza miesiąca, okno nowego nawyku, przypomnienia push (4.3); sen: wykres z zakresami i celem snu (4.4); onboarding i stany puste (4.5); szybkie dodawanie (4.7); wniosek tygodnia (4.8); nowe tabele i kolumny (5); etapy (8). Z nie-celów przeszły do v1: przypomnienia o nawykach i szablony treningów. Minutnik przerwy zostaje na później.
