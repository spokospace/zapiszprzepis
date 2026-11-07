# Handoff: Hero strony głównej (wyszukiwarka) – wariant 3a / 3b

## Overview
Nowa górna część strony głównej zapiszprzepis.pl. Cel: prosta, bardzo czytelna wyszukiwarka dla dorosłych, w większości starszych użytkowników. Jedna kolumna, szukanie jako jedyne zadanie na górze, „Przepis dnia” jako osobny blok pod linią.
Zaakceptowane: **3a (desktop, gość)** i **3b (desktop, zalogowana)**. 3c / 3d (telefon) to propozycja do potwierdzenia — na mobile można zostawić obecny układ, jeśli nie ma decyzji.

## About the Design Files
Pliki w paczce to **referencje projektowe w HTML** (makiety), nie kod produkcyjny. Zadanie: odtworzyć je w istniejącym kodzie repo `spokospace/zapiszprzepis` (Next.js, `src/app`) z użyciem jego komponentów i wzorców. Otwórz `hero-proposals.dc.html` w przeglądarce; sekcja na górze („1c rozbudowane”) zawiera 3a–3d. Niższe sekcje (2a–2d, 1a–1c) to odrzucone warianty.

## Fidelity
**High-fidelity** dla układu, typografii, kolorów i wymiarów. Zdjęcie przepisu dnia to placeholder (paski) — w kodzie prawdziwe zdjęcie.

## Zasady projektu (obowiązują)
- WCAG 2.2 AA: tekst min. 4,5:1, obramowania pól i UI 3:1, cele dotyku min. 48 px, widoczny focus (`outline: 3px solid #1d4ed8; outline-offset: 2px`), linki podkreślone.
- Krój: Atkinson Hyperlegible Next (400 / 700 / 800), fallback Arial, Helvetica.
- **Nie zmieniamy logiki**: podpowiedzi wyszukiwania (`header-search.tsx`, `header-search-panel.tsx`), rozpoznawanie mowy, wybór przepisu dnia, nagłówek i pasek kategorii zostają jak w kodzie. Zmienia się tylko wygląd i kolejność elementów hero.

## Screens / Views

### 3a – Strona główna, desktop, gość
Kontener hero: tło `#fff`, padding `64px 28px 52px`, `display:flex; flex-direction:column; align-items:center; gap:18px; text-align:center`.

Kolejność elementów:
1. **H1** „Czego dziś szukasz?” – 64 px / 800 / line-height 1.02, `#111827`.
2. **Podtytuł** „Przepisy z internetu w jednym miejscu. Zawsze pod ręką, kiedy gotujesz.” – 20 px / 400 / 1.45, `#374151`.
3. **Blok pola** – szerokość 780 px (`max-width:780px; width:100%`), `margin-top:14px`, `text-align:left`, kolumna z `gap:10px`:
   - **Widoczny label** `<label for>` „Wpisz nazwę dania lub składnik” – 19 px / 700, `#111827`. (Zamiast dotychczasowego ukrytego labela – dla starszych osób label musi być widoczny.)
   - **Pole** (form role="search"): wysokość 68 px, `border:2px solid #111827`, `border-radius:999px`, padding `0 5px 0 24px`, flex, gap 8.
     - input: 19 px, placeholder `#4b5563` „np. sernik, zupa z dyni, kurczak”.
     - przycisk submit **„Szukaj”** (tekst, bez samej ikony): wysokość 56 px, padding `0 34px`, tło `#c2410c`, tekst `#fff` 19 px / 700, radius 999px; hover `#9a3412`.
     - **W polu nie ma już przycisku „Powiedz”.**
4. **Rząd głosowy** – flex, `align-items:center; gap:14px`:
   - tekst „albo” 18 px `#374151`,
   - przycisk **„Powiedz, czego szukasz”**: wysokość 52 px, padding `0 18px`, `border:2px solid #111827`, radius 999px, tło `#fff`, 18 px / 700, ikona Lucide `Mic` 22 px po lewej (gap 8). Ta sama akcja co dotychczasowe „Powiedz”.
5. **Często szukane** – kontener 780 px, `border-top:1px solid #d1d5db`, `margin-top:10px`, `padding-top:20px`, kolumna wyśrodkowana, gap 12:
   - tekst „Nie wiesz, co wpisać? Kliknij jedno z najczęściej szukanych:” – 18 px / 700,
   - pigułki (flex-wrap, center, gap 8): wysokość 52 px, padding `0 20px`, `border:2px solid #6b7280`, radius 999px, 18 px / 700, `#111827`. Treść: sernik, pierogi, rosół, szarlotka, naleśniki (lub dane z obecnego źródła „Często szukane”). Klik = wyszukanie tej frazy (jak dziś).
   - Sekcja „Często szukane”, która była niżej na stronie, **znika** (przeniesiona tutaj).

**Przepis dnia** (pod hero): `margin:0 28px; border-top:1px solid #111827; padding:32px 0 48px`, grid `minmax(0,7fr) minmax(0,5fr)`, gap 40, `align-items:center`. Cały blok jest linkiem (`aria-label="Przepis dnia: {tytuł}"`).
- Lewa: zdjęcie 360 px wysokości, `object-fit:cover`, radius 4 px, bez cienia; plakietka źródła jak na kartach (biała, lewy dół: `left:1px; bottom:6px; padding:4px 12px 4px 10px; radius:0 2px 2px 0`, ikona źródła + nazwa, 16 px / 700, jedna linia z „…”).
- Prawa, kolumna gap 12:
  - „PRZEPIS DNIA” – 16 px / 700, uppercase, letter-spacing .08em, `#9a3412`,
  - tytuł – 40 px / 800 / 1.08, `#111827`,
  - podpis – 20 px, `#374151`,
  - link „Zobacz przepis →” – 19 px / 700, `#9a3412`, podkreślony, `margin-top:8px`.

### 3b – Strona główna, desktop, zalogowana
Identyczny układ jak 3a, różnice:
- H1: **„Czego dziś szukasz, {wołacz}?”** (np. „Czego dziś szukasz, Tolu?”). Gdy wołacz niepewny / brak – „Czego dziś szukasz?”. Zastępuje „Dzień dobry, {wołacz}!”.
- Podtytuł: „Szukaj w swoich przepisach i ulubionych albo we wszystkich.”
- Placeholder pola: „np. zupa z dyni”.
- Pod przyciskiem „Powiedz” – ta sama sekcja „Często szukane” co u gościa.
- **Usunięty komunikat „N przepisów wymaga uwagi / Popraw” z hero.** Informacja zostaje tylko w menu powiadomień (`notification-bell.tsx`, bez zmian). Później: osobny kanał błędów dla administratora (np. Telegram) – poza zakresem tej zmiany.
- Nagłówek zalogowanej (Ulubione, + Dodaj przepis, Menu z kropką) bez zmian.

### 3c / 3d – telefon (propozycja, do potwierdzenia)
- Padding hero `28px 16px 24px`, kolumna gap 14, **wyrównanie do lewej**.
- H1 36 px / 800 / 1.05; podtytuł 19 px.
- Label 19 px / 700; pole 60 px, przycisk „Szukaj” 50 px wysokości, padding `0 20px`, 18 px.
- „Powiedz, czego szukasz” na całą szerokość, 52 px, ikona Mic.
- Często szukane: `border-top:1px solid #d1d5db; padding-top:16px`, tekst „Nie wiesz, co wpisać? Kliknij:”, pigułki 52 px, 4 pozycje.
- Przepis dnia pod linią `1px #111827`: zdjęcie na pełną szerokość ekranu (`margin:0 -16px`), 220 px, bez zaokrągleń; tytuł 28 px / 800; podpis 19 px.

## Interactions & Behavior
- Enter w polu / „Szukaj” → wyszukiwanie jak dziś; podpowiedzi pod polem bez zmian logiki (panel otwiera się pod polem o szerokości bloku 780 px).
- „Powiedz, czego szukasz” → istniejące rozpoznawanie mowy, wynik wpisany w pole.
- Pigułka → wyszukiwanie frazy.
- Przepis dnia: hover `opacity:.92`, focus – widoczny outline; Enter/Spacja otwiera przepis.
- Responsywność: blok pola `width:100%; max-width:780px`; poniżej ~768 px układ 3c/3d; grid przepisu dnia przechodzi w jedną kolumnę.

## State Management
Bez nowego stanu. Wołacz w H1 z istniejącego profilu (to samo źródło co dotychczasowe „Dzień dobry, …”). Usuwamy render komunikatu o przepisach wymagających uwagi z hero (dane nadal używane w powiadomieniach).

## Design Tokens
- Tekst `#111827`, pomocniczy `#374151`, placeholder `#4b5563`
- Akcja główna `#c2410c` (hover `#9a3412`), etykiety/ikony kategorii/linki `#9a3412`, link hover `#7c2d12`
- Obramowania: pole i przycisk drugorzędny `#111827` 2 px; pigułki `#6b7280` 2 px; linia sekcji `#111827` 1 px; separator pomocniczy `#d1d5db` 1 px
- Radius: pola/przyciski/pigułki 999px; zdjęcia i kafle 4 px
- Typografia: 64 / 40 / 20 / 19 / 18 / 16 px (mobile H1 36, tytuł 28)
- Focus: `3px solid #1d4ed8`, offset 2 px

## Assets
- Ikony: Lucide (`Mic`, ikony kategorii jak w kodzie: Utensils, Soup, CakeSlice, Cake, Cookie, Coffee, Croissant, Sandwich, Salad).
- Zdjęcie przepisu dnia: z danych przepisu (placeholder w makiecie).

## Files
- `hero-proposals.dc.html` – makiety (sekcja „1c rozbudowane”, id `3a`–`3d`). Otwórz bezpośrednio w przeglądarce (wymaga `support.js` obok).
- Pliki w repo do zmiany: `src/app/page.tsx`, `src/app/components/home/*`, `src/app/components/recipe-search.tsx` / `header-search.tsx` (tylko wygląd: label, przycisk głosowy poza polem).
