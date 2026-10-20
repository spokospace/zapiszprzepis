# Handoff: ZapiszPrzepis — przebudowa nawigacji, wyszukiwarki, przepisu, profilu i dostępu

Repo: `spokospace/zapiszprzepis` (branch `master`, Next.js App Router + Supabase + Tailwind).

## Overview
Aplikacja staje się publiczna: gość może przeglądać i szukać, zalogowany (Facebook lub Google) ma Ulubione i galerię zdjęć, a dodawanie własnych przepisów wymaga pełnego dostępu (kod lub płatność). Projekt porządkuje:
- stronę główną dla gościa i zalogowanego z dużą wyszukiwarką,
- jedną wyszukiwarkę z zakresem Wszystkie / Moje / Ulubione,
- stronę przepisu z „wróć do…”, poprzedni/następny, podobnymi przepisami i trybem gotowania,
- menu (drawer) podzielone na „Moje” i „Wszystkie przepisy według kategorii”,
- osobną stronę „Dodaj przepis” (link teraz, zdjęcie/zrzut ekranu „wkrótce”),
- uproszczony profil, logowanie Facebook/Google, wybór płci przy pierwszym logowaniu, odblokowanie kodem.

Grupa docelowa obejmuje osoby starsze. **WCAG 2.2 AA jest wymaganiem dla każdego ekranu** (patrz `ZASADY_PROJEKTU.md` w tym folderze — dopisz te zasady do `CLAUDE.md` w repo).

## About the Design Files
Pliki w `designs/` to **referencje projektowe w HTML** — prototypy pokazujące wygląd i zachowanie, nie kod produkcyjny. Zadanie: **odtworzyć je w istniejącym kodzie** (Next.js + Tailwind, komponenty w `src/app/components/`), używając jego wzorców. Pliki `.dc.html` otwierają się bezpośrednio w przeglądarce (obok musi leżeć `support.js` i folder `public/`). Ikony to Lucide (`lucide-react` w repo), nazwy ikon w markupie: `data-lucide="…"`.

## Fidelity
**High-fidelity** dla kolorów, typografii, rozmiarów celów dotyku i treści. Zdjęcia dań to paski-placeholdery, liczby przepisów i dane przykładowe. Logo Facebooka/Google na przyciskach logowania to litery „f”/„G” — zastąpić oficjalnymi znakami zgodnie z wytycznymi Meta i Google.

### Który wariant wdrażać
- **Docelowy: 1c (`Propozycja C - wysoka czytelność.dc.html`)** — wzór typografii, kontrastu, kart, przycisków i strony przepisu. Struktura nawigacji jak w **1a**.
- **1a (`Propozycja A.dc.html`)** — pełny zestaw ekranów (gość/zalogowany, wyniki, przepis, drawer, dodawanie) + desktop (A8, A9). Stosować z regułami czytelności z 1c (większe fonty, karty z paskiem „Dodaj do ulubionych”).
- **1b (`Propozycja B.dc.html`)** — alternatywa z dolnym paskiem zakładek i stałym panelem bocznym na desktopie. Nie wdrażać, chyba że zostanie wybrana.
- `Obecna wersja.dc.html` — odtworzenie stanu z `master` do porównania.

## Model danych i dostępu
| | Gość | Zalogowany (FB/Google) | Pełny dostęp |
|---|---|---|---|
| Przeglądanie i szukanie | tak | tak | tak |
| Galeria zdjęć przepisu | nie (zablokowana z liczbą zdjęć + „Zaloguj się”) | tak | tak |
| Ulubione (serce) | nie (kliknięcie → logowanie, po nim powrót i zapis) | tak | tak |
| Dodawanie własnych przepisów | nie | nie (ekran z kodem) | tak |
| „Moje przepisy” w menu | nie | nie | tak |

- **Jeden przepis na link źródłowy** (deduplikacja po znormalizowanym `source_url`, globalnie, nie per użytkownik). Slug **bez loginu**: `/przepis/{recipe-slug}` (unikalny, sufiks przy kolizji), np. `/przepis/zupa-krem-z-dyni`. Stare `/recipes/[slug]` → 301.
- **Moje przepisy** = przepisy, które użytkownik dodał jako pierwszy. Gdy ktoś doda link, który już jest w serwisie: nie tworzymy kopii, przepis trafia do jego Ulubionych i pokazujemy „Ten przepis już jest w ZapiszPrzepis. Dodaliśmy go do Twoich ulubionych.” + „Otwórz przepis”.
- **Źródło zamiast loginu**: na kartach „Kategoria · czas · {źródło}”, na przepisie „Źródło: {źródło}” (ikona globe, 18 px) + „Otwórz oryginał”. Źródło = domena bez `www.` i ścieżki (aniagotuje.pl) albo „YouTube · {kanał}”, „Facebook · {profil/grupa}”, gdy znamy nazwę. Przepisy bez strony (zdjęcie/książka, w przyszłości): „Z książki kucharskiej” / „Przepis od: {podane przez użytkownika}”.
- **Kto dodał**: drobna linijka 16 px „Dodała/Dodał {wyświetlana nazwa}” (forma wg płci dodającego) z podkreślonym linkiem do profilu publicznego `/u/{username}` — lista przepisów dodanych przez tę osobę.
- **Ulubione** = zakładki na dowolne przepisy (własne i cudze), bez kopiowania. Ikona: **serce, zawsze z podpisem** („Dodaj do ulubionych” / „W ulubionych”). Gwiazdka odrzucona — kojarzy się z oceną.
- **Username**: generowany przy rejestracji z imienia (małe litery, cyfry, `-`; `ł→l`, usunięte diakrytyki, unikalność przez sufiks). Nie edytowany w profilu.
- **Płeć**: wybierana raz po pierwszym logowaniu (ekran 3b), nieedytowalna. Służy do odmiany („Dodałaś / Dodałeś”).
- **Kod dostępu**: jednorazowo przypisany do konta. Potrzebna tabela kodów (kod, limit użyć, data ważności, użyty przez). Wielkość liter bez znaczenia.

## Decyzje (finalne)
Wybrane warianty — wdrażać tylko je; pozostałe pliki to kontekst:
- **Nawigacja mobile:** przycisk MENU w nagłówku (1a), bez dolnego paska zakładek.
- **Nagłówek (mobile, handoff v8):** poniżej lg dla wszystkich (gość, zalogowany, pełny dostęp) napis „Zapisz Przepis” · „Szukaj” (lupa) · „MENU” — szczegóły w `ZMIANY_nawigacja_mobile.md` (E01-S25). „Dodaj” nie ma w nagłówku poniżej lg: „Dodaj przepis” jest w menu (sekcja „Moje”; bez pełnego dostępu z kłódką) i jako kafel na stronie głównej. Od lg „+ Dodaj przepis” zostaje w nagłówku. Zastępuje „Dodaj · MENU”. Bez zmian: **bez „Powiadomień”** w nagłówku telefonu — są w MENU (wiersz w „Moje” + licznik na przycisku MENU, #323); komputer: dzwonek w nagłówku (A8–A9, niżej).
- **Logo (mobile, handoff v8):** w nagłówku poniżej lg sam napis „Zapisz Przepis” (bold, „Przepis” w `#c2410c`), bez ikony, 24 px. Link do „/”, `aria-label="Zapisz Przepis — strona główna"`. Ikona `logo-icon.svg` zostaje na logowaniu (3a), /signup, favicon i PWA; od lg nagłówek bez zmian (ikona + napis). Zastępuje progi 360/640 px z #328.
- **Nazwa (handoff v8):** wszędzie „Zapisz Przepis” (dwa słowa, wielkie litery) — w nagłówku (napis: „Zapisz” `#111827`, „Przepis” `#c2410c`, odstęp `margin-left:.28em`), na logowaniu, w tytułach stron (`… · Zapisz Przepis`), e-mailach, `manifest.json` i `aria-label`. W zdaniach z odmianą: „w aplikacji Zapisz Przepis”. Adres = „zapiszprzepis.pl”. Zamienić wszystkie „ZapiszPrzepis” w UI i `LogoWordmark` (E01-S24).
- **Wyszukiwanie (handoff v8):** poniżej lg na pełnym ekranie (ekran 4, E01-S26). Otwiera je lupa w nagłówku albo pole na stronie głównej; input dostaje focus. Szukanie głosem przyciskiem „Powiedz” (E01-S27).
- **Menu:** na cały ekran, sekcje „Moje” i „Wszystkie przepisy według kategorii”, kategorie jako kafle 2 kolumny (1c, C5).
- **Wyniki i kategorie:** lista kart (miniatura, pełny tytuł, pasek „Dodaj do ulubionych”) (1c, C2).
- **Poprzedni / następny:** na końcu przepisu, jeden pod drugim z tytułami (1c, C3).
- **Strona główna zalogowanego:** wyszukiwarka + 3 kafle (Moje przepisy, Ulubione, Dodaj przepis) + kategorie (1c, C1).
- **Komputer:** górny nagłówek z wyszukiwarką, „+ Dodaj przepis”, Powiadomienia, MENU (1a, A8–A9).
- **Profil:** etykieta „Twój obrazek” (wgrywanie zdjęcia lub kolor + litera).
- **1b** (`Propozycja B.dc.html`) — odrzucona alternatywa, nie wdrażać.

## Screens / Views
Wymiary mobilne: 390 px szerokości. Desktop: kontener `max-width: 1152px`, padding 32 px.

### Nagłówek (mobile, 1c)
- Wysokość ~64 px, `border-bottom: 2px solid #e5e7eb`, padding `4px 12px 4px 16px`.
- Lewo: logo = sam napis „Zapisz Przepis” 24 px bold, bez ikony (handoff v8, E01-S25; od lg ikona `public/logo-icon.svg` + napis — przed v8 ikona + napis od 360/640 px, #328), albo „← Wróć” (18 px bold, cel 56 px) na ekranach pod startową. Strona przepisu (C3, #344): „← {lista}” w nagłówku („← Wyniki”, „← Ciasteczka”), bez osobnego paska listy poniżej lg; od lg rząd A9 „← {lista} · N z M” (jeden link wstecz na ekran; zastępuje pasek listy z #324). Źródło prawdy: `src/app/components/app-header.tsx` (#276, #320). **Nie** wracać do `public/logo-lettering.svg` — to stare logo, a ten wiersz raz już je przywrócił (#286).
- Prawo, wszyscy (gość i zalogowany, na **każdym** ekranie): dwa przyciski ikona nad podpisem, wysokość 56 px, podpis 13 px bold, ikona 24 px:
  - **„Szukaj”** 64 px szer., ikona search, link do `/szukaj` (pełny ekran, ekran 4). Ukryty na `/szukaj` (handoff v8, E01-S25). Zastępuje „Dodaj” (64 px, tło `#c2410c`), który od v8 jest w nagłówku tylko od lg.
  - **„MENU”** 60 px. Gdy są powiadomienia: licznik na przycisku — koło 22 px `#b91c1c`, biały 13 px bold, obwódka 2 px biała; nazwa dostępna „MENU, N powiadomień”. Nieudane sprawdzenie: bursztynowa kropka.
- **Bez „Powiadomień” w nagłówku telefonu** (#323): rzadko potrzebne, a zajmowały najszerszy przycisk (100 px). Wejście to wiersz „Powiadomienia” w MENU; dzwonek zostaje tylko w nagłówku komputera. Dzięki temu „← Wróć” mieści się w jednym wierszu 18 px także przy 320 px.
- Gość: „Szukaj” + MENU — „Zaloguj się” / „Załóż konto” są w MENU (#324). Od 1024 px „Zaloguj się” + „Załóż konto” w nagłówku.

### 8 — Wersje tego samego dania (`Wersje przepisu.dc.html`)
- Pod blokiem źródła przycisk-pasek 60 px (`#fff7ed`, ramka `#fed7aa`, ikona layers): „Mamy jeszcze N inne przepisy na {danie}” + strzałka w dół → płynne przewinięcie do sekcji. Ukryty, gdy N = 0.
- Sekcja „Inne przepisy na {danie} (N)” **przed** „Podobnymi”, z podpisem „Różnice w porównaniu z przepisem, który oglądasz.”
- Karta wersji (cała klikalna, `border: 2px`, radius 16): miniatura 72 px; **opis różnicy jako tytuł** 19 px bold (np. „Na kruchym cieście, bez drożdży”); nazwa przepisu i źródło 16 px; plakietki `#f3f4f6` „8 porcji (o 4 mniej)”, „1 godz. 30 min (krócej)” (próg 10 min); „+ jest: …” (`#15803d`) i „− nie ma: …” (`#b91c1c`), do 4 składników; link „Otwórz ten przepis”.
- Sortowanie: liczba dodań do ulubionych malejąco.
- „Podobne przepisy” wykluczają przepisy z tym samym `dish`.
- Dane: nowe pole `dish` (znormalizowana nazwa dania) i `variant_note` (krótki opis wersji), oba z AI przy ekstrakcji; porównanie składników po znormalizowanych nazwach przy renderowaniu.

### 7 — Profil publiczny (`Profil publiczny.dc.html`, `/u/{username}`)
- Wejście: link „Dodała {nazwa}” przy przepisie. Dostępny dla gości.
- Nagłówek profilu: obrazek 88 px, wyświetlana nazwa 28 px bold, „Dodała/Dodał N przepisów” 17 px, „W ZapiszPrzepis od {miesiąc rok}” 16 px.
- Chipy kategorii (jak w 6: 48 px, zaznaczony `#111827` + ✓, liczniki) — tylko kategorie, w których osoba coś dodała.
- Lista: przepisy dodane jako pierwsza osoba, od najnowszych; karta jak w wynikach (miniatura 84, tytuł 19 bold, „kategoria · czas”, źródło). „Pokaż kolejne”.
- Własny profil: blok `#f3f4f6` „Tak widzą Twój profil inni.” + „Zmień nazwę lub obrazek” → `/settings`.
- Nie pokazujemy: imienia, emaila, płci, ulubionych. Bez obserwowania/komentarzy.
- Pusty: „{nazwa} nie dodała jeszcze przepisów”; `noindex` dla profili bez przepisów.

### 6 — Kategoria z tagami i podobne (`Kategoria i tagi.dc.html`)
- Strona kategorii `/przepisy/{kategoria}?tag=a,b`: ikona 52 px + nazwa 28 px + „N przepisów w kategorii”.
- „Jakie ciasteczka?” 19 px bold + „Możesz zaznaczyć kilka. Pokażemy przepisy, które pasują do wszystkich.” 16 px.
- Chipy tagów: min. 48 px, radius 999, `border: 2px solid #9ca3af`, 17 px bold + licznik 16 px; zaznaczony: tło `#111827`, biały, prefiks „✓ ”, `aria-pressed`. Zawijane (flex-wrap), gap 8. Tylko tagi występujące w kategorii; sortowanie: zaznaczone, potem liczba malejąco. Pierwsze 8 + „Pokaż wszystkie (N)”.
- Logika AND (`.contains('tags', sel)`); liczniki liczone na bieżących wynikach; tagi z 0 wyników ukryte.
- Podsumowanie (`aria-live`): „3 przepisy: kruche i czekoladowe” + „× Wyczyść” (48 px). Pusty stan: „Brak … z tymi tagami”.
- Karta wyniku: miniatura 84 px, tytuł 19 px bold, „czas · źródło”, tagi „kruche · maślane” 16 px.
- **Dół przepisu**: „Ten przepis jest” + tagi jako przyciski 48 px (`#fff7ed`/`#fed7aa`, ikona tag) → kategoria z tym tagiem; „Podobne: {tag} {kategoria}” — 3–4 przepisy z tej samej kategorii, sortowane po liczbie wspólnych tagów, z podpisem „też kruche i czekoladowe”; „Wszystkie {kategoria} (N) →” 56 px.
- Dopisać do `RECIPE_TAGS`: `kokosowe`, `owsiane` (i inne brakujące rodzaje ciastek).

### 4 — Wyszukiwarka na pełnym ekranie (`Wyszukiwarka.dc.html`, handoff v8)
- Otwierana z lupy „Szukaj” w nagłówku (każdy ekran) lub z pola „Czego szukasz?” na stronie głównej. Mobile: pełny ekran (route `/szukaj` albo overlay z `history.pushState`, żeby przycisk Wstecz telefonu zamykał). Nagłówek: „✕ Zamknij” + „Szukaj przepisu”.
- Pasek szybkich haseł przyklejony do dołu widoku (nad klawiaturą: `position: sticky; bottom: 0` + `visualViewport`/`interactive-widget=resizes-content`), widoczny bez wpisanego hasła i podczas pisania do 2 liter. Tytuł 16 px bold „Ostatnio i często szukane” (gość: „Często szukane”). Chipy 48 px, 17 px bold, radius pełny, gap 8 px, przewijanie w poziomie wewnątrz paska (strona nie przewija się w bok). Najpierw ostatnie (ikona `history`, ramka 2 px `#4b5563`, max 5 z localStorage), potem popularne (ikona `trending-up`, tło `#fff7ed`, ramka `#fdba74`, z `PopularSearches`). Naciśnięcie = `/szukaj?q=…`.
- Pole 60 px, tekst 19 px, focus po otwarciu; obok „Powiedz” (mikrofon + podpis) gdy pole puste, „Wyczyść” gdy wpisano.
- Głos: Web Speech API (`lang='pl-PL'`, `interimResults: true`). Ekran „Słucham…” 28 px, koło 120 px `#c2410c` z pulsowaniem (wyłączyć przy `prefers-reduced-motion`), rozpoznany tekst na żywo 24 px, po ciszy automatyczne szukanie. Przycisk „Przestań słuchać i pisz”. Brak wsparcia lub zgody → komunikat jak włączyć mikrofon, przycisk ukryty gdy API niedostępne.
- Instrukcja wdrożenia: `ZMIANY_nawigacja_mobile.md` §3–§5, checklista: `ISSUE_lupa_szukaj.md`.

### 5 — Powiadomienia (`Powiadomienia.dc.html`)
Zastępuje dropdown z `notification-bell.tsx` pełnoekranowym panelem (mobile) — dropdown 320 px z tekstem 12–14 px jest nieczytelny.
- Nagłówek: „← Wróć” + tytuł „Powiadomienia” 28 px.
- Typy wpisów (karta `border: 2px`, radius 16, padding 16):
  - **Problem** (ramka `#b91c1c`, ikona circle-alert): „Nie udało się dodać przepisu”, domena (np. „youtube.com”, 17 px), powód zrozumiałym językiem (mapowanie `error_message` → tekst, np. „Na tej stronie nie znaleźliśmy przepisu.”, „Film jest prywatny albo został usunięty.”, „Strona nie odpowiada. Spróbuj za chwilę.”), czas („dziś o 9:40”). Przyciski: „Spróbuj ponownie” 56 px `#c2410c` (retryShare) i „Usuń” 48 px obramowany (dismissShare).
  - **W trakcie**: „Spisujemy przepis z kwestiasmaku.com”, spinner, „Zwykle trwa to 1–3 minuty.” Bez przycisków.
  - **Gotowe**: (ramka `#15803d`) „Przepis gotowy”, tytuł 19 px bold, „Otwórz przepis” 56 px.
- Sekcje: „Wymaga uwagi” (problemy), „W trakcie”, „Wcześniej” (gotowe). Licznik = problemy + nieprzeczytane gotowe.
- Wejście (#323): na telefonie i tablecie wiersz „Powiadomienia” w MENU (sekcja „Moje”, czerwony licznik) + licznik na przycisku MENU; na komputerze dzwonek „Powiadomienia” w nagłówku. `Powiadomienia.dc.html` pokazuje jeszcze dzwonek w nagłówku telefonu — nieaktualne.
- „Usuń przeczytane” na dole. Pusty stan: „Nie ma nowych powiadomień” + wyjaśnienie, co tu się pojawi.
- Błąd ładowania: „Nie udało się sprawdzić powiadomień.” + „Spróbuj ponownie”.
- **Pasek na stronie głównej** (pod powitaniem), gdy jest problem: tło `#fef2f2`, ramka `#b91c1c`, „1 przepis wymaga uwagi” + „Zobacz” — starsze osoby często nie zauważają samego licznika.
- Wymaga nowych stanów w danych: obecnie są tylko nieudane udostępnienia (`failed-shares`); trzeba dodać „w trakcie” i „gotowe” (np. z tabeli udostępnień/Inngest).

### C1 / A1 / A2 — Strona główna
- **Gość (A1)**: sekcja hero `#fff7ed`: H1 „Czego dziś szukasz?” 28 px bold; opis 18 px `#374151`; pole wyszukiwania 60 px, `border: 2px solid #c2410c`, radius 14, placeholder „Danie lub składnik, np. dynia”, ikona mikrofonu; przycisk „Szukaj przepisu” 56 px `#c2410c`; chipy „Często szukane”. Dalej: „Kategorie” siatka 3 kolumny (kafel `#fff7ed`, ikona 26 px `#9a3412`, nazwa 17 px bold), „Ostatnio dodane” siatka 2 kolumny, blok CTA `#111827` „Zapisuj przepisy z linku i zbieraj ulubione” + „Załóż konto” / „Zaloguj się”.
- **Zalogowany (C1)**: „Dzień dobry, {wołacz}” 28 px bold (bez imienia gdy wołacz niepewny); label „Czego szukasz?” 18 px bold + pole 60 px (`border: 2px solid #4b5563`) + przycisk „Szukaj” 58 px; trzy wiersze-kafle (min. 64 px, `border: 2px solid #e5e7eb`, radius 16, ikona 28 px, tytuł 20 px bold, podpis 16 px, chevron): „Moje przepisy” (tylko pełny dostęp), „Ulubione”, „Dodaj przepis”; „Kategorie” siatka 2 kolumny, kafel 56 px `#fff7ed` z `border: 1.5px solid #fed7aa`, nazwa 18 px bold.

### C2 / A3 — Wyniki wyszukiwania (`/szukaj?q=`)
- Pole z wartością + „× Wyczyść” (cel 48 px).
- „Szukaj w:” 16 px bold + segment 3 przycisków 52 px: Wszystkich / Moich / Ulubionych (aktywny `#111827` biały tekst, nieaktywny `border: 2px solid #d1d5db`). Gość: segment ukryty.
- Wiersz: „**18 przepisów** dla „dynia”” 19 px + przycisk „Kategoria” (filtr).
- Karta wyniku: `border: 2px solid #e5e7eb`, radius 16; miniatura 96×96 radius 12; tytuł 20 px bold, line-height 1.25 (max 2 linie, bez ucinania w środku słowa); „Kategoria · czas” i źródło 16 px `#374151`; pasek pod kartą 52 px z `border-top: 2px` — „♡ Dodaj do ulubionych” (`#111827`) lub „♥ W ulubionych” (tło `#fff7ed`, tekst `#9a3412`).
- Paginacja: „Pokaż kolejne 14” 56 px, bez infinite scroll.
- Na końcu (A3): „Nie ma tego, czego szukasz?” + „Szukaj „{q}” w internecie” (istniejąca wyszukiwarka zewnętrzna).

### C3 / A4 / A5 — Przepis (`/przepis/{slug}`)
Kolejność od góry:
1. Pasek powrotu: „← {nazwa listy źródłowej}” (Wyniki: „dynia” / Zupy / Ulubione) + „1 z 18”.
2. Zdjęcie 4:3, radius 16.
3. Okruszki „Przepisy › Zupy”, tytuł 32 px bold line-height 1.15.
4. „Zupy · 45 minut” 17 px; „Źródło: **YouTube · Kuchnia Ani**” 18 px z ikoną globe; „Dodała [Ania K.]” 16 px, link do `/u/ania`.
5. Przycisk ulubionych 58 px: nieaktywny `border: 2.5px solid #c2410c`, tekst `#9a3412` „Dodaj do ulubionych”; aktywny tło `#c2410c`, biały „W ulubionych · usuń”. Po dodaniu komunikat `#111827` „Dodano do ulubionych · **Cofnij**” (`role="status"`, ~5 s).
6. „Wielkość tekstu” A / A+ / A++ (przyciski 52×48) → skala treści 1 / 1.15 / 1.3, zapisana w `localStorage`.
7. „Tryb gotowania” 58 px `#111827`.
8. Składniki: „na 4 porcje”; wiersz min. 56 px, checkbox 32 px (`border: 2.5px solid #4b5563`, zaznaczony `#15803d` + ✓), nazwa 19 px, ilość 19 px bold; zaznaczone → przekreślenie, kolor `#4b5563`.
9. Przygotowanie: etykieta „Krok 2 z 3” 17 px bold `#9a3412`, treść 19 px line-height 1.6.
10. Galeria: gość — blok zablokowany (kłódka, „Galeria 6 zdjęć jest dostępna po zalogowaniu.”, „Zaloguj się”); zalogowany — siatka zdjęć.
11. „Otwórz oryginał na YouTube” (obramowany przycisk 48 px).
12. Poprzedni / Następny: dwa przyciski 64 px jeden pod drugim (mobile), podpis 14 px bold „Poprzedni przepis”, tytuł 18 px bold. Desktop: obok siebie, podpis „Poprzedni w wynikach „dynia””.
13. „Podobne przepisy” — 4 karty (ta sama kategoria + wspólne tagi), „Wszystkie zupy (96) →”.

### C4 — Tryb gotowania
Pełny ekran, tło `#111827`, tekst biały. Góra: nazwa przepisu 17 px `#e5e7eb` + „× Zakończ” (56 px). Pasek postępu: segmenty 8 px (`#fb923c` zrobione, `#374151` reszta). „Krok N z M” 22 px bold `#fdba74`; treść kroku 30 px, weight 600, line-height 1.45. „Ekran nie wygaśnie podczas gotowania” — **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`, ponawiać po `visibilitychange`). Dół: „← Wstecz” 72 px (`border: 2px solid #6b7280`) i „Dalej →” 72 px tło `#ea580c` **tekst `#111827`**.

### C5 / A6 / 3d — Menu
Pełny ekran na mobile (1c), panel 330 px w 1a. Nagłówek „Menu” 22 px + „× Zamknij”.
- Sekcja **„Moje”** (16 px bold `#374151`): Moje przepisy (licznik, tylko pełny dostęp), Ulubione (licznik), Dodaj przepis, Powiadomienia (czerwony licznik, „Nie udało się sprawdzić” przy błędzie; tylko < 1024 px, bo na komputerze jest dzwonek — #323). Bez pełnego dostępu (3d): „Dodaj przepis” z podpisem „Wymaga kodu lub pełnego dostępu” i ikoną kłódki → ekran 3c.
- Separator 2 px.
- Sekcja **„Wszystkie przepisy według kategorii”**: siatka 2 kolumny kafli 54 px (lista kategorii z `src/lib/recipe-categories.ts`). Kategoria otwiera wyniki w zakresie „Wszystkie”.
- Stopka: „Mój profil” (w 1c „Ustawienia”) | „Wyloguj”, 64 px.
- Gość: zamiast sekcji „Moje” — „Zaloguj się” / „Załóż konto”.

### A7 — Dodaj przepis (`/dodaj`)
H1 „Dodaj przepis”; dwa kafle: „Z linku” (aktywny, `border: 2px solid #c2410c`, tło `#fff7ed`) i „Ze zdjęcia — Zrzut ekranu lub książka · wkrótce” (wyszarzony, nieaktywny). Label „Link do przepisu” + pole 56–60 px z przyciskiem „Wklej” (Clipboard API). Przycisk „Dodaj przepis” 54–58 px. Lista 3 kroków (spisujemy po polsku / 1–3 minuty / gotowy przepis w „Moje przepisy”, problem → dzwonek). Bez pełnego dostępu ta trasa pokazuje ekran 3c.

### 2a — Mój profil (`/settings`)
Jeden ekran, bez kroków:
1. „Twój obrazek” — kółko 96 px: zdjęcie (gdy wgrane) lub pierwsza litera nazwy na kolorze. Wgrywanie zdjęcia (np. kartki, obrazki) + wybór koloru tła z 6 (przyciski 52 px, wybrany ma `3px solid #111827` i ✓, `aria-label` z nazwą koloru). Zdjęcie domyślnie z Facebooka/Google.
2. „Nazwa przy przepisach” — pole 60 px.
3. „Imię” — pole 60 px.
4. Podgląd (`aria-live="polite"`, tło `#fff7ed`): „Dzień dobry, Antonino! Dodałaś 3 nowe przepisy.”
5. „Zapisz zmiany” 58 px `#c2410c` → „✓ Zapisano”.
6. Konto: email (tylko odczyt), „Wyloguj”.
Płci i username **nie ma** na tym ekranie.

### 3a — Logowanie (`/login`)
„← Wróć”; logo jak w nagłówku — ikona `logo-icon.svg` + napis „Zapisz**Przepis**” tekstem, wspólny komponent `brand-logo.tsx` (#331; pierwotnie `logo-lettering.svg` 160×40); „Zaloguj się” 30 px; „Bez nowego hasła. Użyj konta, które już masz.” 18 px; przyciski 60 px: „Zaloguj przez Facebooka” (tło `#1877f2`, biały) i „Zaloguj przez Google” (`border: 2px solid #4b5563`); „Pierwsze logowanie od razu zakłada konto. Nic nie publikujemy na Twoim Facebooku.”; stopka z linkami do regulaminu i polityki prywatności (podkreślone).
Implementacja: `supabase.auth.signInWithOAuth({ provider: 'facebook' | 'google', options: { redirectTo: `${origin}/auth/callback?next=…` } })` — istniejący `src/app/auth/callback/route.ts` obsługuje powrót. Konfiguracja: aplikacja w Meta for Developers (Facebook Login, publiczna polityka prywatności i instrukcja usuwania danych), klient OAuth w Google Cloud; włączenie obu providerów w Supabase. Obsłużyć konto Facebook bez emaila i łączenie kont o tym samym emailu.

### 3b — Pierwsze logowanie
Po pierwszym callbacku, gdy profil nie ma płci: avatar 80 px, „Witamy, {wołacz}!” 30 px, „Jeszcze jedno pytanie, żeby dobrze się do Ciebie zwracać.”, radiogroup „Jestem”: „Kobietą” / „Mężczyzną” (60 px, wybrany `#111827`), „Tego nie można później zmienić w ustawieniach.”, „Dalej” 60 px `#c2410c` (nieaktywne do wyboru). Po zapisie → powrót do `next`.

### 3c — Odblokowanie dodawania
Kłódka 64 px w kole `#fff7ed`; „Dodawanie własnych przepisów” 28 px; opis 18 px; label „Masz kod?” + pole 60 px (monospace 20 px, uppercase); błąd: `role="alert"`, 17 px bold `#b91c1c`, ikona + „Ten kod nie działa. Sprawdź litery i spróbuj jeszcze raz.”, ramka pola `#b91c1c`; „Odblokuj” 58 px `#c2410c`; „albo”; „Zobacz pełny dostęp” (płatność — do ustalenia); „Ulubione działają bez ograniczeń, z kodem i bez.” Sukces (`role="status"`): zielony ✓ `#15803d` na `#dcfce7`, „Gotowe! Możesz dodawać przepisy.”, od razu formularz linku.

### Desktop (A8, A9)
- Nagłówek: logo 140×35, „Przepisy”, „Kategorie ▾”, [gość] „Zaloguj się” + „Załóż konto”; [zalogowany] pole wyszukiwania (max 460 px, 48 px), „+ Dodaj przepis”, dzwonek, MENU.
- Hero gościa: H1 46 px, pole 760 px × 64 px + „Szukaj”; kategorie 9 kolumn; „Ostatnio dodane” 4 kolumny.
- Przepis: zdjęcie 16:10 + kolumna z tytułem 44 px, autorem, czasami (20 px bold) i przyciskami 54 px (W ulubionych / Udostępnij / Oryginał); dalej siatka `1fr 1.6fr`: składniki w panelu `#f9fafb` | kroki + galeria 4 kolumny; poprzedni/następny obok siebie; podobne 4 kolumny.

## Interactions & Behavior
- **Lista źródłowa przepisu**: przy wejściu z wyników/kategorii/ulubionych przekazać kontekst (np. `?from=search&q=dynia` lub stan w sessionStorage). Z niego: etykieta „Wróć”, licznik „N z M”, poprzedni/następny. Bez kontekstu: kategoria przepisu.
- **Serce u gościa**: przekierowanie do `/login?next={url}&fav={id}`; po zalogowaniu dodać do ulubionych i wrócić.
- **Ulubione**: optimistic update + komunikat z „Cofnij”.
- **Wielkość tekstu**: `localStorage`, dotyczy treści przepisu (składniki, kroki).
- **Składniki**: odhaczanie lokalne (per przepis, sessionStorage).
- **Wołacz**: słownik imion (generowany np. Morfeuszem 2 z listy imion PESEL) + reguły zapasowe: `-sia/-nia/-cia/-zia → -u`, `-a → -o`; imiona męskie tylko ze słownika; brak pewności → „Dzień dobry!”.
- **Zmiana sluga**: stare adresy przekierowują (301).
- Brak przewijania w poziomie; brak gestów bez przycisku-odpowiednika.

## State Management
- `user`: `{ id, displayName, firstName, vocative, gender: 'f'|'m'|null, username, avatarUrl|null, avatarColor, hasFullAccess }`.
- `favorites`: zbiór id przepisów (+ liczniki do menu).
- Wyszukiwanie: `q`, `scope: 'all'|'mine'|'favorites'`, `category`, `page`.
- Przepis: `sourceList` (typ, parametry, pozycja), `textScale`, `checkedIngredients`, `cookingStep`, `wakeLock`.
- Kod: `code`, `error`, `redeeming`; po sukcesie odśwież sesję/profil.

## Design Tokens
Kolory:
- Tekst główny `#111827`; pomocniczy `#374151` (min.); wyłączony/placeholder `#4b5563`
- Akcja (biały tekst) `#c2410c`; tekst akcentu na jasnym `#9a3412`; hover linku `#7c2d12`
- Jasny pomarańcz (tylko z ciemnym tekstem) `#ea580c`; postęp `#fb923c`; akcent na ciemnym `#fdba74`
- Tła akcentu `#fff7ed`, `#ffedd5`; obramowanie akcentu `#fed7aa`
- Obramowania pól `#4b5563` (2 px); obramowania kart `#e5e7eb` / `#d1d5db`
- Powierzchnie `#ffffff`, `#f9fafb`, `#f3f4f6`; ciemna `#111827`
- Błąd `#b91c1c`; sukces `#15803d` / `#dcfce7`; Facebook `#1877f2`
- Focus: `outline: 3px solid #1d4ed8; outline-offset: 2px`
- **Nie używać `#f97316` z białym tekstem** (2,8:1).

Typografia (Arial/Helvetica jak w repo; mobile):
- H1 28–32 px bold, line-height 1.15; H2 22–24 px bold
- Treść przepisu 19 px, line-height 1.5–1.6; tryb gotowania 30 px
- Tytuł karty 20 px bold; etykiety pól 18 px bold; pomocniczy min. 16 px; podpisy ikon w nagłówku 13 px bold
- Linki zawsze podkreślone

Rozmiary / odstępy:
- Cele dotyku min. 48 px; przyciski główne 56–60 px; tryb gotowania 72 px; odstęp między celami min. 8 px
- Radius: 10 (małe), 12, 14 (przyciski/pola), 16 (karty), 24 (ramka telefonu w makiecie), 999 (koła)
- Padding ekranu 16 px (mobile), gap sekcji 16–24 px
- Cień kart w makietach `0 10px 30px rgba(0,0,0,.08)` dotyczy tylko prezentacji

## Assets
- `designs/public/logo-lettering.svg`, `designs/public/logo.svg` — z repo (`public/`).
- Ikony: Lucide (`lucide-react`). Używane m.in.: search, mic, x, menu, bell, plus, heart, book-open, layout-grid, arrow-left/right, chevron-right/down, lock, camera, link, clipboard-paste, external-link, share-2, chef-hat, sun, settings, log-out, user, info, circle-alert, check, globe, sliders-horizontal oraz ikony kategorii z `recipe-categories.ts`.
- Oficjalne logo Facebooka i Google — pobrać z ich brand guidelines.
- Zdjęcia dań — prawdziwe zdjęcia przepisów (w makiecie placeholdery).

## Files
- `designs/Propozycja C - wysoka czytelność.dc.html` — 1c: C1–C5 (docelowy styl)
- `designs/Propozycja A.dc.html` — 1a: A1–A7 mobile, A8–A9 desktop (docelowa struktura)
- `designs/Propozycja B.dc.html` — 1b: alternatywa z dolną nawigacją
- `designs/Ustawienia profilu.dc.html` — 2a: Mój profil
- `designs/Logowanie i dostęp.dc.html` — 3: macierz dostępu, 3a–3d
- `designs/Wyszukiwarka.dc.html` — 4: wyszukiwarka na pełnym ekranie (serwis + blogi + głos)
- `designs/Powiadomienia.dc.html` — 5: powiadomienia
- `designs/Kategoria i tagi.dc.html` — 6: kategoria z tagami i podobne
- `designs/Profil publiczny.dc.html` — 7: profil publiczny
- `designs/Wersje przepisu.dc.html` — 8: inne wersje tego samego dania
- `designs/Obecna wersja.dc.html` — stan obecny
- `ZMIANY_nawigacja_mobile.md` — handoff v8: nazwa „Zapisz Przepis”, nagłówek mobile z „Szukaj”, `/szukaj` na pełnym ekranie, głos (E01-S24…S27)
- `ISSUE_lupa_szukaj.md` — handoff v8: checklista tych samych zmian
- `ZASADY_PROJEKTU.md` — zasady projektu (WCAG, czytelność, model danych) do dopisania w `CLAUDE.md` repo

Pliki w repo do zmiany (punkt wyjścia): `src/app/page.tsx`, `src/app/components/app-header.tsx`, `app-menu.tsx`, `recipe-card.tsx`, `recipe-search.tsx`, `category-filter.tsx`, `add-recipe-form.tsx`, `recipe-gallery.tsx`, `src/app/(authenticated)/recipes/*`, `src/app/(authenticated)/settings/page.tsx`, `src/app/auth/callback/route.ts`, `src/lib/recipe-categories.ts`. Strony publiczne (strona główna, wyszukiwarka, przepis) trzeba wyjąć z grupy `(authenticated)`, a RLS w Supabase otworzyć na odczyt przepisów dla `anon`.
