# Instrukcja zmian: karta przepisu, źródło, strona główna (mobile + desktop)

Dla Claude Code. Repo `spokospace/zapiszprzepis` (master, Next.js App Router + Tailwind). Ten plik **nadpisuje** wcześniejsze opisy kart i źródła w `README.md` (sekcje „Źródło zamiast loginu”, karta wyniku C2, przepis C3 pkt 11, profil `/u`, desktop A8/A9).

Projekt referencyjny: `designs/recipe-source.dc.html` (sekcje 8, 9, 10, 11). Wdrożony przykład mobile: `designs/proposal-c-high-readability.dc.html` (C2, C3). Pliki HTML to **referencje**, nie kod do skopiowania — odtworzyć w komponentach repo (`recipe-card.tsx`, `favorite-button.tsx`, `recipes/[slug]/page.tsx`, `components/home/*`, `app-header.tsx`, `brand-logo.tsx`).

Zasady: `design-rules.md` (zaktualizowane — przenieść do `CLAUDE.md` w repo). WCAG 2.2 AA, cele dotyku min. 48 px, pomocniczy tekst min. 16 px `#374151`.

---

## 1. Jeden komponent `RecipeCard` wszędzie

Używany w: Moje przepisy, Ulubione, wyniki `/szukaj`, kategoria, profil `/u/[username]`, strona główna (gość i zalogowany), „Podobne”, „Inne przepisy na …”. Usunąć inne warianty kart (miniatura 96×96 z tekstem obok, karta z paskiem „Dodaj do ulubionych” pod spodem, mała miniatura w „Inne przepisy”).

Budowa (od góry):
1. **Zdjęcie**, `position: relative`, `object-fit: cover`, radius górny 16 (karta ma `overflow: hidden`).
2. **Plakietka źródła** — lewy dolny róg zdjęcia (`left: 8px; bottom: 8px; max-width: calc(100% - 16px)`):
   - tło `#fff`, radius 8, padding `5px 10px`, tekst 16 px bold `#111827`,
   - ikona 18 px + nazwa źródła, gap 6 px,
   - **jedna linijka**: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` na nazwie, ikona `flex-shrink: 0`,
   - na karcie plakietka **nie jest linkiem** (cała karta prowadzi do przepisu).
3. **Serduszko** — prawy górny róg (`right: 8px; top: 8px`):
   - koło 48×48, tło `#fff`, ramka 2 px `#6b7280`, ikona `Heart` 22 px `#9a3412`,
   - w ulubionych: tło `#c2410c`, ikona wypełniona biała,
   - **bez napisu na karcie**; `aria-label="Dodaj do ulubionych"` / `"Usuń z ulubionych"`, `aria-pressed`, `title` taki jak label,
   - osobny cel kliknięcia (`stopPropagation`), nie otwiera przepisu.
4. **Treść** (padding 12 px, gap 4 px):
   - nazwa 19–20 px bold, line-height 1.25, max 2 linie (`line-clamp: 2`),
   - **podpis** (`recipe.subtitle`, np. „z musem jabłkowym”) 16 px `#374151`, line-height 1.4. Brak podpisu → nic (bez pustego wiersza).
5. **Bez etykiety kategorii** (usunąć chip „Ciasta/Desery/Przekąski”) i **bez linijki źródła pod tytułem** (źródło jest na zdjęciu).

Ramka karty: 2 px `#e5e7eb`, radius 16, tło `#fff`. W siatce karty mają równą wysokość (`align-items: stretch`).

### Treść plakietki (helper `formatSource(recipe)`)
| Typ | Ikona (lucide) | Tekst |
|---|---|---|
| strona www | `Globe` | domena bez `www.` i ścieżki: `aniagotuje.pl` |
| YouTube | `Youtube` | `YouTube · {kanał}`; bez kanału: `YouTube` |
| Facebook | `Facebook` | `Facebook · {profil/grupa}`; bez nazwy: `Facebook` |
| książka | `BookOpen` | `Z książki kucharskiej` |
| od osoby | `User` | `Przepis od: {nazwa}` |

---

## 2. Rozmiary karty — mobile i desktop

### Mobile (< 768 px)
- **Lista** (Moje przepisy, Ulubione, wyniki, kategoria, profil): jedna kolumna, karta na całą szerokość, **zdjęcie 210 px** wysokości. Pod listą „Pokaż kolejne 24” (56 px, ramka 2 px `#4b5563`), bez infinite scroll.
- **Karuzela** (Podobne, Inne przepisy na …, rzędy na stronie głównej): karta **270 px** szerokości, zdjęcie **170 px**, gap 12 px; kontener przewijany w poziomie z `scroll-snap-type: x mandatory`, padding-left 16 px, widoczny brzeg następnej karty. Pod spodem dwa przyciski 56 px obok siebie: „‹ Poprzednie” / „Następne ›” (przewijają o jedną kartę; nieaktywny na początku/końcu, `aria-disabled`). Pod nimi link „Wszystkie {kategoria} ({n}) →” (56 px, ramka 2 px `#c2410c`, tekst `#9a3412`).
- Przewijanie w poziomie tylko wewnątrz karuzeli; strona nie przewija się w bok (sprawdzić 320 px).

### Desktop (≥ 768 px)
- **Siatka i karuzela używają tej samej karty**, zdjęcie **180 px** (170 px na stronie głównej), gap 16 px.
- Kolumny: **4 od 1024 px**, **3 od 768 px** (`grid-template-columns: repeat(N, minmax(0,1fr))`).
- Karuzela desktop = jeden rząd siatki. Przyciski „‹ Poprzednie” / „Następne ›” (48 px) po prawej w wierszu tytułu sekcji, przesuwają o cały rząd. Link „Wszystkie … →” pod rzędem, wyrównany do lewej.

---

## 3. Strona przepisu — źródło jako plakietka na zdjęciu

- Usunąć: linijkę „Źródło: …” (ikona globe), przycisk **„Oryginał”** obok „Udostępnij” oraz przycisk „Otwórz oryginał na …” pod krokami.
- Na zdjęciu głównym, lewy dolny róg (`left/bottom: 10–12px`): **plakietka-link** do oryginału:
  - `<a href={source_url} target="_blank" rel="noopener">`, min-height 48 px, padding `0 14px` (desktop `0 16px`), radius 999, tło `#fff`, ramka 2 px `#6b7280`,
  - ikona typu źródła 18 px (desktop 20) + nazwa (podkreślona, ellipsis) + ikona `ExternalLink` 16 px (desktop 18),
  - tekst 16 px bold `#111827` (desktop 17 px),
  - `aria-label="Otwórz oryginał: {źródło} (nowa karta)"`, widoczny focus `outline: 3px solid #1d4ed8; outline-offset: 2px`.
  - Przepisy bez strony (książka / od osoby): plakietka bez linku, bez `ExternalLink`, bez ramki.
- Pod tytułem (28–34 px bold): **podpis** 19 px `#374151` („z marmoladą różaną”).
- Niżej: czasy, „Dodała {nazwa}” 16 px `#374151` z podkreślonym linkiem do `/u/{username}`.
- Przyciski: **„Dodaj do ulubionych”** (pełny napis, tylko tutaj; 56 px, ramka 2 px `#c2410c`, tekst `#9a3412`; w ulubionych tło `#c2410c`, tekst biały „W ulubionych”) + „Udostępnij”. Na desktopie obok siebie (`flex: 1`).
- Na mobile i desktopie to samo; zmienia się tylko układ (desktop: zdjęcie po lewej, kolumna z tytułem po prawej, `grid 1.1fr 1fr`, gap 28).

### Inne przepisy na … (wersje)
- Żółta ramka „Mamy jeszcze N innych przepisów na …” → zwykły link **„Inne przepisy na {danie} ({n}) ↓”** (17 px bold `#9a3412`, kotwica do sekcji). Na desktopie: `margin: 10px 0`, bez podkreślenia, podkreślenie na `:hover` / `:focus-visible` (wyjątek od zasady podkreślania — link wyróżnia kolor, pogrubienie i strzałka).
- Sekcja „Inne przepisy na {danie} ({n})” + podtytuł 16 px „Czym różnią się od przepisu, który oglądasz”. Sortowanie (Najpopularniejsze / Najnowsze / Najszybsze) zostaje. Mobile: lista rozwijana zamiast pigułek (projekt 11b) — przycisk 48 px „⇅ Kolejność: {wybrana} ▾” (etykieta 400 `#374151`, wartość 700), po dotknięciu lista z wierszami 56 px, wybrana z ✓ i tłem `#f3f4f6`. Desktop: pigułki bez zmian.
- Karty: **ta sama `RecipeCard`** (karuzela mobile / rząd desktop), pod podpisem dodatkowo:
  - czas, np. „1 godz. 40 min (krócej)” 16 px `#374151`,
  - „**Ma dodatkowo:** …” — etykieta bold `#166534`, lista `#111827` 16 px,
  - „**Nie ma:** …” — etykieta bold `#991b1b`, lista `#111827` 16 px.
  Kolor nie jest jedynym nośnikiem znaczenia (słowa w etykiecie). Usunąć „+ jest:” / „− nie ma:” i małe szare teksty.
- Usunąć link „Otwórz ten przepis →” (cała karta jest linkiem).

---

## 4. Strona główna (desktop; mobile analogicznie z karuzelami)

Gość i zalogowany mają **ten sam układ**:
1. Nagłówek (bez zmian z `changes-mobile-navigation.md`).
2. Hero `#fff7ed`, wyśrodkowany: H1 36–46 px bold, podtytuł 17 px `#374151`, pole 56–64 px (ramka 2 px `#c2410c`, „Powiedz”) + „Szukaj” `#c2410c`.
3. Sekcje z kartami (pkt 1–2).
4. Kategorie: desktop — pasek kategorii w nagłówku (pkt 4a); mobile — 9 kafli pod hero, min-height 76 px, tło `#fff7ed`, ramka 2 px `#fed7aa`, ikona 22 px + nazwa 16 px bold `#9a3412`.

### Gość
- Bez zmian poza kartami: „Często szukane”, „Kategorie”, „Ostatnio dodane” (nowa karta: źródło na zdjęciu, podpis, bez etykiety kategorii, równe wysokości), blok „Zapisuj przepisy z linku…”.
- Serduszko u gościa: najpierw komunikat (toast / popover) „Zaloguj się, żeby zapisać ulubione.” + link „Zaloguj się”, dopiero potem logowanie; po zalogowaniu powrót i zapis.

### Zalogowany (zamiast obecnej listy linków)
- Usunąć: drugą wyszukiwarkę pod nagłówkiem na desktopie (zostaje jedna — w hero), trzy wiersze „Moje przepisy / Ulubione / Dodaj przepis”, kafle kategorii w kolorze `#fff7ed` pod nimi.
- Nagłówek desktop: patrz pkt 4a.
- Hero: „Dzień dobry, {imię w wołaczu}!” + „Szukaj w swoich przepisach i ulubionych albo we wszystkich” + pole.
- Komunikat o nieudanych dodaniach (`failed-shares`, grupa „Wymaga uwagi” w Powiadomieniach): zamiast czerwonej ramki `#fef2f2` z „{n} przepisy wymagają uwagi” — ramka 2 px `#9a3412` na białym tle, ikona `AlertCircle` `#9a3412`, tekst 17 px: „**Nie udało się dodać {n} {przepisu/przepisów}** · możesz spróbować ponownie” + link „Zobacz w powiadomieniach” → ekran Powiadomień (tam „Spróbuj ponownie” / „Usuń” per wpis). Odmiana liczby jak w `notifications.dc.html`. Pokazywać tylko gdy n > 0.
- Sekcje (rzędy kart, pkt 2): „Ostatnio dodane przez Ciebie” + link „Wszystkie moje ({n}) →”, „Ulubione” + „Wszystkie ulubione ({n}) →” (serduszka wypełnione). Pustą sekcję ukryć; jeśli obie puste — kafel „Dodaj pierwszy przepis”.
- Na desktopie bez kafli kategorii na stronie (są w pasku nagłówka); na mobile kafle jak u gościa.

### 4a. Nagłówek desktop (≥ 768 px), z myślą o starszych osobach
Powody: ikony bez podpisu są dla starszych osób niejasne (badania: podpisy usuwają różnice wieku w rozumieniu ikon); ukryta nawigacja (samo MENU) jest wyraźnie mniej odkrywalna na desktopie (NN/g); sklepy pokazują kategorie jako pierwszy poziom nawigacji, stale widoczny (Baymard).

**Rząd 1** (padding `12px 28px`, ramka dolna 2 px `#e5e7eb`):
- lewo: `LogoWordmark` — **sam napis**, bez ikony (24 px bold, „Przepis” `#c2410c`, `letter-spacing: 0`),
- prawo (gap 12): 
  - „Ulubione” — link 48 px, ikona `Heart` 22 px `#9a3412` + napis 17 px bold `#111827`, bez tła/ramki; podkreślenie na `:hover`,
  - „Dodaj przepis” — **sam obrys**: 48 px, ramka 2 px `#c2410c`, tekst `#9a3412` 17 px bold, ikona `Plus` 20 px, radius 12, bez wypełnienia (jedyne wypełnione CTA to „Szukaj” w hero),
  - MENU (ikona + napis, kropka powiadomień) — bez zmian.
- Usunąć z rzędu 1: „Moje przepisy” i „Kategorie ▾” (Moje przepisy zostają w MENU i w sekcji „Ostatnio dodane przez Ciebie”).

**Rząd 2 — pasek kategorii** `<nav aria-label="Kategorie">` (padding `2px 16px`, ramka dolna 2 px `#e5e7eb`, `display:flex; flex-wrap:wrap; justify-content:center; column-gap:4px`):
- 9 linków do `/kategoria/{slug}`: ikona 18 px `#9a3412` + nazwa 16 px bold `#111827`, wysokość 48 px, padding `0 6px`, `white-space: nowrap`,
- `:hover`/`:focus-visible`: kolor `#9a3412` + podkreślenie; aktywna kategoria `aria-current="page"` + podkreślenie stałe,
- przy wąskim oknie zawija do drugiego rzędu (żadna kategoria nie znika, brak poziomego scrolla),
- widoczny na wszystkich stronach desktop (gość i zalogowany); na mobile ukryty (kategorie w MENU i kafle na stronie głównej).

### 4b. Kolejność „Inne przepisy na …” — mobile
Patrz pkt 3 (lista rozwijana, projekt 11b). Plik w repo: `src/app/przepis/[slug]/_components/dish-versions-sort.tsx`. Bez JS: zostawić linki `?wersje=` (np. `<details>` z listą linków). Lista: `role="listbox"` lub natywny `<select>` stylizowany; zamknięcie Esc i klik poza; focus wraca na przycisk; komunikat `aria-live` jak dziś. Zaktualizować `dish-versions-sort.test.ts`.

---

## 5. Logo

- `LogoWordmark` w nagłówku: `letter-spacing: 0` (usunąć ewentualne `tracking-*`). Reszta bez zmian (24 px bold, „Przepis” `#c2410c`).

---

## 6. Testy

- `RecipeCard`: renderuje plakietkę źródła dla każdego typu (tabela w pkt 1), ellipsis przy długiej nazwie, brak chipa kategorii, podpis gdy jest, serduszko z `aria-label` i `aria-pressed`, klik serca nie nawiguje.
- Strona przepisu: brak przycisku „Oryginał” i linku „Otwórz oryginał”; plakietka-link ma `target="_blank"`, `rel="noopener"` i `aria-label`; książka = brak linku.
- „Inne przepisy”: etykiety „Ma dodatkowo:” / „Nie ma:” w DOM.
- Karuzela: przyciski „Poprzednie / Następne” przewijają, `aria-disabled` na krańcach; brak poziomego scrolla strony przy 320 px.
- Strona główna zalogowanego: jedna wyszukiwarka, brak trzech wierszy linków, sekcje ukryte gdy puste.
- Gość: klik serca pokazuje komunikat, nie przekierowuje od razu.
- Nagłówek desktop: brak „Moje przepisy” i „Kategorie ▾” w rzędzie 1; „Ulubione” ma widoczny napis; „Dodaj przepis” bez wypełnienia; `nav[aria-label="Kategorie"]` z 9 linkami, bez poziomego przewijania przy 768 px.
- Kolejność wersji (mobile): przycisk pokazuje bieżący wybór; wybór z listy sortuje i zapisuje w localStorage.
- Grep: brak „Źródło:” i „Oryginał” jako przycisku w UI.
