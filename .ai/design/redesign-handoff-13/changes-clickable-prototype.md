# Instrukcja zmian: wygląd 1b, nagłówek, strona główna, przepis, filtry (prototyp klikalny)

_Aktualizacja 21.10.2026 — zastępuje poprzednią wersję tego pliku._

Dla Claude Code. Repo `spokospace/zapiszprzepis` (master, Next.js App Router + Tailwind). Ten plik jest **najnowszy** i ma pierwszeństwo przed `changes-cards-source-home.md` tam, gdzie się różnią (nagłówek desktop pkt 4a, strona główna pkt 4).

Referencja: `Zapisz Przepis - prototyp klikalny.html` (jeden plik, działa offline) albo `designs/clickable-prototype.dc.html` (otwórz w przeglądarce; przełączniki Desktop / Telefon, Gość / Zalogowana). Karty: `designs/recipe-card.dc.html`, rzędy: `designs/card-row.dc.html`. Pliki HTML to **referencje**, nie kod do skopiowania.

**Zasada nadrzędna: nie zmieniać istniejącej logiki.** Wszystko, co już działa na produkcji, zostaje 1:1 (np. `cooking-mode.tsx`, `recipe-checklists.tsx`, `text-size-controls.tsx`, `tag-filter.tsx` + `category-tags.ts`, `dish-versions-sort.tsx` na desktopie, `header-search.tsx` + panel podpowiedzi, `app-menu`, `RecipeListBar` / `RecipeListNav`, akcje właściciela). Prototyp tylko je odtwarza. Zmieniamy wyłącznie to, co opisano niżej.

---

## 1. Krój pisma: Atkinson Hyperlegible Next

- Jeden krój na całej stronie: **Atkinson Hyperlegible Next** (Google Fonts, OFL, polskie znaki), przez `next/font/google`.
- Grubości: tytuły i nagłówki 700–800, przyciski i etykiety 600–700, treść 400.
- Fallback: `Arial, Helvetica, sans-serif`.
- Powód: znaki I / l / 1 i O / 0 są nie do pomylenia (ważne przy ilościach w składnikach). Porównanie: `designs/typefaces-comparison.dc.html` (2a vs 2b — wybrany 2b).

## 2. Nagłówek desktop (≥ 1024 px)

**Rząd 1** (padding `12px 28px`, linia dolna **1 px `#111827`**):
- lewo: logo-napis „Zapisz Przepis” (bez ikony), 24 px bold, „Przepis” `#c2410c`,
- prawo (gap 12): „Ulubione” (ikona `Heart` 22 px `#9a3412` + napis 17 px bold, bez ramki i bez podkreślenia, podkreślenie na hover), „+ Dodaj przepis” (pigułka `border-radius: 999px`, sam obrys 2 px `#c2410c`, tekst `#9a3412`, 48 px; u gościa w tym miejscu „Zaloguj się” w tym samym stylu), „Menu” (ikona + napis, zwykła pisownia, nie „MENU”; kropka powiadomień).

**Rząd 2 — pasek kategorii** `<nav aria-label="Kategorie">` (linia dolna 1 px `#111827`):
- **jeden rząd, przewijany w poziomie** (nie zawija), `overflow-x: auto`, ukryty pasek przewijania, `column-gap: 20px`, padding `4px 170px 4px 20px` (miejsce na przycisk),
- 12 kategorii (z `recipe-categories.ts`): ikona 18 px `#9a3412` + nazwa 16 px bold, 48 px wysokości, `white-space: nowrap`; aktywna `aria-current="page"` + podkreślenie,
- przyciski przewijania: z prawej **„Więcej ›”**, z lewej (po przewinięciu) **„‹ Wstecz”**; `position: absolute`, pełna wysokość paska, tło `linear-gradient(270deg, #fff 0, #fff calc(100% - 56px), transparent)` (lewy odpowiednio 90deg), padding od strony kategorii 64 px — tekst pod gradientem znika, napis przycisku zawsze na pełnym białym; przewijają o `clientWidth − 160`; pokazuj tylko gdy jest dokąd przewijać (sprawdzaj `scrollLeft` / `scrollWidth` na `scroll` i `resize`).

## 3. Nagłówek mobile

Układ bez zmian względem produkcji: strona główna — logo-napis + „Szukaj” + „Menu”; podstrony — **„← Wróć”** + „Szukaj” + „Menu” (bez logo).
**Nowa logika „← Wróć” (zmiana względem produkcji, zaakceptowana):**
- na stronie przepisu „Wróć” **pomija kolejne przepisy w historii** i wraca do ekranu, od którego zaczęło się przeglądanie (lista kategorii, Ulubione, Moje przepisy, wyniki wyszukiwania albo strona główna). Na pozostałych podstronach cofa o jeden krok jak dziś.
- napis mówi, dokąd: „← Desery”, „← Ulubione”, „← Moje przepisy”, „← Wyniki”, „← Strona główna”; `max-width: calc(100% - 140px)`, `text-overflow: ellipsis`; `aria-label="Wróć: {pełna nazwa}"`.
- implementacja: trzymaj w stanie/sessionStorage „punkt powrotu” (ostatni nie-przepisowy URL) aktualizowany przy wejściu na listę; „Następny / Poprzedni przepis” go nie zmienia. Gdy brak punktu → `/`.

Zmiana: podpisy pod ikonami **zwykłą pisownią** („Menu”, nie „MENU”) i **16 px** bold (dziś 13 px), przyciski min. 64 × 56 px. Porównanie: `designs/header-labels-comparison.dc.html` (wybrane 1b).

## 4. Menu (drawer)

Układ jak na produkcji (`app-menu`). Zmiany:
- **nowa pierwsza pozycja „Strona główna”** (ikona `House` 24 px + napis 19 px bold, 56 px, linia pod spodem 2 px `#e5e7eb`), dla gościa i zalogowanego; przenosi na `/` i **czyści historię nawigacji** (`router.replace('/')`), na stronie głównej `aria-current="page"`,
- nagłówek sekcji „Moje” → **„Twoje konto”**,
- „Powiadomienia”: zamiast kropki **licznik** — kółko min. 28 × 28 px, tło `#c2410c`, biała liczba 16 px bold, `aria-label="{n} nowe powiadomienie/a/ń"`; liczniki „Moje przepisy” / „Ulubione” zostają szare (`#f3f4f6`),
- **pasek „Menu / Zamknij” nie przewija się**: panel `overflow: hidden`, nagłówek `flex-shrink: 0`, przewija się tylko lista pod nim (`flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain`),
- kategorie w menu: **lista w 2 kolumnach**, nie pigułki — wiersze 56 px, linia dolna 1 px `#d1d5db`, linia górna listy 1 px `#d1d5db`, ikona 20 px `#9a3412` + nazwa 17 px bold `#111827`, bez tła i bez zaokrągleń, hover tło `#f9fafb`,
- animacja otwarcia: tło `opacity 0→1` 200 ms, panel `translateX(100%)→0` 280 ms `cubic-bezier(.2,.8,.2,1)`; `prefers-reduced-motion: reduce` → bez animacji,
- desktop: panel 460 px z prawej, cień `-12px 0 32px rgba(17,24,39,.18)`; mobile: pełna szerokość jak dziś.

## 5. Strona główna

### 5a. Górna część (hero) — styl 1b
- **Tło białe** (nie `#fff7ed`), padding desktop `44px 28px 36px`, mobile `24px 16px`.
- Desktop: dwie kolumny `repeat(auto-fit, minmax(min(100%, 400px), 1fr))`, gap 32, `align-items: end`. Lewa: powitanie **H1 50 px / 800 / line-height 1.05** (mobile 32 px), podtytuł **19 px** `#374151`, pole szukania. Prawa: **przepis dnia**.
- Mobile: jedna kolumna; przepis dnia pod polem, zdjęcie **na pełną szerokość ekranu** (`margin: 0 -16px`, bez zaokrągleń), 220 px.

### 5b. Pole szukania (jedno pole z doklejonym przyciskiem)
- `<form role="search">`: **pigułka** — ramka 2 px `#111827`, `border-radius: 999px`, `padding-right: 4px`, bez cienia; wysokość **60 px desktop / 56 px mobile**,
- w środku: ikona lupy (padding-left 20 px), `input type="search"`, (desktop) „Powiedz” 44 px pigułka z ramką `#111827`, na końcu **„Szukaj”** jako pomarańczowa pigułka wewnątrz pola (wysokość `100% − 8px`, tło `#c2410c`, tekst biały 17 px bold, padding 0 26 px),
- mobile: „Powiedz, czego szukasz” jako osobny przycisk 48 px pod polem,
- placeholder: desktop „Danie lub składnik”, mobile „np. pączki”.
- Podpowiedzi: logika z `header-search.tsx` / `header-search-panel.tsx` bez zmian. Zmiana wyglądu panelu: **ramka 2 px `#6b7280`** (3:1 do białego), radius 16, cień `0 12px 28px rgba(17,24,39,.18)`, odstęp 6 px pod polem; wiersze podpowiedzi oddzielone 1 px `#e5e7eb`; aktywny wiersz tło `#f3f4f6`.

### 5c. Przepis dnia (nowe)
- Jeden przepis na dzień, ten sam dla wszystkich: indeks z dnia roku (np. `dayOfYear * 7 + year` mod liczba kandydatów) albo tabela `recipe_of_the_day` wypełniana cronem. **Bez przycisku „Wylosuj inny”.**
- Kandydaci: przepisy z dobrym zdjęciem, **bez YouTube** (`source_type !== 'youtube'`).
- Wygląd (styl 1b, **tekst pod zdjęciem**, nie na zdjęciu): cały blok jest linkiem (`aria-label="Przepis dnia: {tytuł}"`); zdjęcie desktop 240 px, radius 4 px, bez cienia; na zdjęciu tylko plakietka źródła (pkt 6); pod zdjęciem: „PRZEPIS DNIA” (16 px bold, `letter-spacing .08em`, wersaliki, `#9a3412`), tytuł 26 px bold (mobile 24 px), podpis 17 px `#374151`.

### 5d. Komunikat „Nie udało się dodać N przepisów”
- Desktop: jeden wiersz, padding `2px 12px 2px 16px` (ok. 56 px wysokości), link „Zobacz w powiadomieniach” 48 px.
- Mobile: cała ramka jest linkiem do Powiadomień: ikona, pogrubiony tytuł, pod nim „Dotknij, żeby spróbować ponownie” 16 px `#374151`, strzałka › z prawej.

### 5e. Kategorie na mobile
Kafle pod hero (3 kolumny, gap 8, min-height 76 px): **białe, ramka 1 px `#111827`, radius 4 px**, ikona 24 px **`#9a3412`**, nazwa 16 px bold `#111827`. Nad nimi nagłówek „Kategorie” 26 px z linią górną 1 px `#111827`. Na desktopie kafli nie ma (są w pasku nagłówka).

### 5f. Sekcje z kartami (`Rząd kart`)
Nagłówek sekcji 28 px bold z **linią górną 1 px `#111827`** i `padding-top: 14px`; „Poprzednie / Następne” jako pigułki 48 px (mobile 56 px) z ramką 2 px `#111827`; „Pokaż wszystkie” jako **podkreślony link** 18 px bold (nie przycisk); odstęp w siatce 24 px.
Komunikat „Nie udało się dodać” i blok dla gościa: radius 4 px (blok gościa bez tła, z linią górną 1 px `#111827`).

## 6. Karty (`RecipeCard`)

Budowa bez zmian (`changes-cards-source-home.md` pkt 1). Zmiany (styl 1b):
- **karta bez ramki i bez tła** — samo zdjęcie + tekst pod nim; zdjęcie **radius 4 px**, `overflow: hidden`, **bez obrysu**,
- pod zdjęciem (`padding: 10px 0 4px`, gap 6): tytuł **21 px bold**, podpis **17 px** `#374151`,
- hover: `opacity: .92`; focus: domyślny widoczny outline przeglądarki (karta to link),
- serduszko **bez ramki**, cień `0 2px 8px rgba(17,24,39,.22)` (biały krąg 48 px; w ulubionych tło `#c2410c`),
- **plakietka źródła** (wszędzie tak samo: karty, przepis dnia, zdjęcie przepisu): biała, **bez ramki**, `position: absolute; left: 1px; bottom: 6px`, `padding: 4px 12px 4px 10px`, `border-radius: 0 2px 2px 0` (zaokrąglona tylko z prawej), ikona 18 px + nazwa 16 px bold, jedna linijka z „…”, `max-width: calc(100% - 12px)`.
Siatki desktop: `repeat(auto-fill, minmax(200–220px, 1fr))` zamiast sztywnych 4 kolumn, żeby przy 768–1024 px nie było ściśniętych kart.

## 7. Strona przepisu — bez zmian logiki

Odtworzone 1:1 z produkcji: `RecipeListBar` + okruszki (desktop), czasy (Przygotowanie / Gotowanie lub Pieczenie / Łącznie; mobile jedna linijka „Kategoria · czas”), opis, „Wielkość tekstu A / A+ / A++”, „Tryb gotowania” (dialog z `cooking-mode.tsx`), składniki z odhaczaniem i grupami, kroki, „Następny na liście” / „Następny przepis”, wersje dania, podobne, „Odśwież / Usuń przepis” dla właściciela.
Jedyna zmiana: żółta ramka `DishVersionsBar` → link „Inne przepisy na {danie} ({n}) ↓” (już opisane w `changes-cards-source-home.md` pkt 3) oraz sortowanie wersji na mobile jako lista rozwijana (pkt 4b tamże).
Link „Dodała {imię}”: zwiększony obszar kliknięcia (`padding: 12px 2px; margin: -12px 0`).

**Zmiany wyglądu na stronie przepisu (styl 1b):**
- zdjęcie główne i ramka składników (desktop): radius **4 px**,
- przyciski („Dodaj do ulubionych”, „Udostępnij”, „Tryb gotowania”, A / A+ / A++, „Zdjęcia kroków”, sortowanie wersji, „Odśwież / Usuń”) jako **pigułki** `border-radius: 999px`; drugorzędne z ramką 2 px `#111827`,
- plakietka źródła na zdjęciu = link do oryginału: wygląd identyczny jak na kartach (pkt 6), nazwa podkreślona + ikona `ExternalLink`; **cel dotyku 48 px** zapewnia przezroczysty `<button>` (`min-height: 48px; align-items: flex-end; padding-bottom: 6px`), wewnątrz którego leży mała plakietka. „Z książki kucharskiej” — ten sam wygląd bez linku.

**„Poprzedni / Następny przepis” (nowe: Poprzedni):**
- `<nav aria-label="Sąsiednie przepisy">` nad nim linia 1 px `#111827`,
- przyciski: min-height 64 px, ramka **1 px `#111827`, radius 4 px** (spójnie z kaflami), mały napis 16 px `#374151` („Poprzedni” / „Następny na liście: {lista}” / „Następny przepis”) + tytuł 18 px bold; strzałka ← z lewej w „Poprzedni”, → z prawej w „Następny”,
- „Poprzedni” **tylko gdy przepis otwarto z listy** (kategoria, Ulubione, Moje przepisy, wyniki) i nie jest pierwszy; z przepisu dnia / karuzeli / linku — sam „Następny przepis”,
- desktop: oba → 2 równe kolumny; sam „Następny” → z prawej 420 px; sam „Poprzedni” → z lewej 420 px; mobile: jeden pod drugim, pełna szerokość, „Poprzedni” na górze,
- przejście Poprzedni/Następny **nie dodaje wpisu** do punktu powrotu „Wróć” (pkt 3).

## 8. Stopka (desktop)

Nowa: linia górna 2 px `#e5e7eb`, tło `#f9fafb`, padding `20px 28px`. Lewo: „Zapisz Przepis” 19 px bold + „© 2026 zapiszprzepis.pl” 16 px `#374151`. Prawo: podkreślone linki 17 px, 48 px wysokości: Regulamin (`/regulamin`), Polityka prywatności (`/polityka-prywatnosci`), Usuwanie danych (`/usuwanie-danych`). Na mobile bez stopki (do decyzji).

## 8a. Zdjęcia przy krokach

Szczegóły danych i importu: `change-step-photos.md`. Wygląd w aktualnej wersji:
- zdjęcie pod tekstem kroku, 4:3, **radius 4 px**, bez ramki i **bez podpisu/plakietki** na liście, mobile 100% / desktop max 520 px,
- zdjęcie to `<button aria-haspopup="dialog" aria-label="Powiększ zdjęcie do kroku {n}">`, `cursor: zoom-in`,
- przełącznik „Zdjęcia kroków: Pokaż / Ukryj” (pigułki 48 px) tylko gdy przepis ma zdjęcia kroków; wybór w `localStorage`,
- **lightbox** (`role="dialog" aria-modal="true"`): tło `rgba(17,24,39,.94)`; u góry tytuł „Krok {n} · zdjęcie {i} z {m}” 19 px bold + „Zamknij” (48 px, focus trafia tu po otwarciu); środek: zdjęcie `height: min(56vh, calc(100% - 96px), 660px); width: auto; max-width: 100%; aspect-ratio: 4/3`, pod nim **tekst kroku** 19 px (podpis tylko tutaj); kontener `justify-content: safe center; overflow-y: auto; overflow-x: hidden`; dół: „‹ Poprzednie” / „Następne ›” (pigułki 56 px, biała ramka 2 px, `aria-disabled` na końcach) przełączają tylko zdjęcia kroków; Esc, klik w tło i „Zamknij” zamykają, focus wraca na kliknięte zdjęcie; ← → przełączają,
- tryb gotowania: zdjęcie bieżącego kroku nad tekstem, `height: min(34vh, 300px)`, radius 4 px, bez podpisu.

## 8b. Filtry tagów w kategorii (mobile)

Logika `tag-filter.tsx` + `category-tags.ts` bez zmian (AND, liczniki). Zmiany:
- **mobile: jeden rząd przewijany w poziomie** (`flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity`), **od krawędzi do krawędzi** (`margin: 0 -16px; padding: 0 16px`, `scroll-padding-inline: 16px 120px` — focus nie chowa się pod „Więcej”); widoczne wszystkie tagi, bez „Pokaż wszystkie”,
- nagłówek tylko pytanie („Jakie obiady?”) 17 px; tekst „Możesz zaznaczyć kilka…” **tylko desktop**,
- **stała kolejność tagów**: według liczby przepisów w całej kategorii; zaznaczenie nie przestawia tagów (zaznaczony zostaje pod palcem/focusem),
- tag, który przy bieżącym wyborze dałby 0 wyników: **nie znika**, tylko `aria-disabled="true"`, tło `#f3f4f6`, ramka `#d1d5db`, tekst `#4b5563`, licznik „0”, kliknięcie nic nie robi (fokusowalny),
- tag: pigułka 48 px, `white-space: nowrap; flex-shrink: 0`; zaznaczony: tło `#111827`, tekst biały, „✓ ”,
- **„Więcej ›”** na końcu rzędu (tylko mobile): `position: absolute` przy prawej krawędzi ekranu, pełna wysokość rzędu, tło `linear-gradient(270deg, #fff 0, #fff calc(100% − 40px), transparent)`, 16 px bold + chevron, `aria-label="Więcej tagów"`; przewija o `clientWidth − 120` (smooth); ukryty, gdy koniec rzędu (sprawdzaj na `scroll`/`resize`/po zmianie tagów),
- pasek wyniku: `border-radius: 4px`, mobile `padding: 4px 4px 4px 12px`, tekst 17 px, „× Wyczyść” pigułka 48 px w tej samej linii,
- desktop bez zmian (zawijanie, pierwsze 8 + „Pokaż wszystkie (n)”).

## 9. Responsywność — sprawdzone

- 320 / 340 / 390 px (mobile) i 780 px (desktop): brak poziomego przewijania strony, przewijają się tylko karuzele i pasek kategorii.
- Testy: brak poziomego scrolla przy 320 px na stronie głównej, przepisie, kategorii i w menu; pasek kategorii nie zawija; „Więcej” znika na końcu paska; hero przechodzi w jedną kolumnę poniżej ~840 px szerokości treści.

## 10. Kierunek wizualny 1b — wdrożony w całości

`designs/modern-look-proposals.dc.html`, wariant **1b** (czysty, kontrastowy). Zasady do stosowania na **wszystkich** ekranach (także tych, których prototyp nie pokazuje):
- **Przyciski = pigułki** (`border-radius: 999px`); główne: tło `#c2410c`, tekst biały; drugorzędne: białe z ramką 2 px `#111827`; „Dodaj przepis” w nagłówku: obrys `#c2410c`.
- **Kafle, karty, zdjęcia, ramki informacyjne = 4 px** (`border-radius: 4px`), ramki 1 px `#111827` tam, gdzie kafel potrzebuje granicy; zdjęcia bez obrysu.
- **Sekcje** oddzielone linią 1 px `#111827` nad nagłówkiem 26–28 px; tła sekcji białe (bez `#fff7ed`).
- **Pomarańcz** tylko dla akcji głównej, ikon kategorii (`#9a3412`), etykiet („PRZEPIS DNIA”, „Krok n”) i liczników powiadomień.
- Linie pomocnicze (listy w menu, separatory wierszy): 1 px `#d1d5db` / `#e5e7eb`.
- Stary wygląd przed tymi zmianami: `archiwum` w projekcie projektowym (nie w paczce).
