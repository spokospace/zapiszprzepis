# Handoff: Inne wersje przepisu + tagi przepisu

## Overview
Strona przepisu na zapiszprzepis.pl, dwie sekcje pod treścią przepisu:
1. **„Inne wersje {dania w dopełniaczu} (N)”** (dotąd „Inne przepisy na pączki (5)”) – ta sama karta co wszędzie + porównanie składników.
2. **„Zobacz więcej przepisów:”** (dotąd „Ten przepis jest” + podtytuł „Kliknij, żeby zobaczyć podobne desery.”) – tagi przepisu.

## About the Design Files
Pliki to **referencje projektowe w HTML**, nie kod produkcyjny. Odtwórz je w repo `spokospace/zapiszprzepis` (Next.js, `src/app`) z użyciem istniejących komponentów (karta przepisu, karuzela, sortowanie). Otwórz pliki .dc.html w przeglądarce (wymagają `support.js` obok).
- `Inne wersje - propozycja.dc.html` – statyczna makieta: 4a desktop, 4b telefon.
- `Prototyp klikalny.dc.html` – działający prototyp (wejdź w „Pączko bułeczki z piekarnika”); używa `Rząd kart.dc.html` i `Karta przepisu.dc.html`.

## Fidelity
High-fidelity: układ, typografia, kolory, wymiary. Zdjęcia to placeholdery.

## Zasady (obowiązują)
WCAG 2.2 AA (tekst 4,5:1, UI 3:1, cele dotyku ≥ 48 px, focus `3px solid #1d4ed8` offset 2 px, linki podkreślone). Krój Atkinson Hyperlegible Next 400/700/800. Nie zmieniamy logiki (sortowanie, wybór wersji, porównanie składników) – tylko wygląd i teksty.

## 1. Inne wersje
- Nagłówek H2: „Inne wersje pączków (5)” – 24–28 px / 700. Nazwa dania w dopełniaczu (pole w danych lub mapa; brak – mianownik).
- Podtytuł: „Czym różnią się od tego przepisu” – 16–17 px, #374151.
- Link-skrót przy przepisie („Mamy jeszcze N innych…”) – bez zmian logiki.
- Kolejność: desktop – pigułki, telefon – rozwijana lista (bez zmian).
- **Karta = wspólny komponent karty przepisu**: zdjęcie o tej samej proporcji co na innych kartach, plakietka źródła lewy dół, serduszko 48 px prawy górny róg (aria-label „Dodaj do ulubionych”), tytuł 21 px / 700, podpis 17 px #374151. Wcześniej brakowało serduszka, a zdjęcia były szerokie i niskie.
- Pod podpisem:
  - czas 16 px #374151, np. „1 godz 40 min (krócej)”,
  - separator `border-top:1px solid #e5e7eb; margin-top:4px; padding-top:8px`,
  - „**Ma dodatkowo:** …” i „**Nie ma:** …” – 16 px / 1.4, `#111827`, etykieta pogrubiona **bez koloru** (było zielony/czerwony – kolor nie może nieść znaczenia, WCAG 1.4.1), każda linia max 2 wiersze (`-webkit-line-clamp:2`, „…”). Pełna lista w przepisie.
- Desktop: siatka **3 kolumny** (`repeat(3,minmax(0,1fr))`, gap `32px 24px`), wszystkie wersje widoczne, bez paginacji.
- Telefon: karuzela jak „Podobne” – karta 270 px, widoczny brzeg następnej, scroll-snap, pod spodem „Poprzednie / Następne” (56 px, po pół szerokości). Naprawia nachodzące na siebie karty z obecnej wersji.

## 2. Tagi przepisu
- Nagłówek H2: „Zobacz więcej przepisów:” – 24–28 px / 700. **Podtytuł usunięty.**
- Pigułki: wysokość 52 px, padding `0 18px`, `border:2px solid #111827`, radius 999px, tło #fff, tekst `#9a3412` 18 px / 700, ikona Lucide `Tag` 20 px po lewej; hover tło `#fff7ed`.
- Klik: lista kategorii przepisu z zaznaczonym tym tagiem (jak dziś).

## Kolejność sekcji pod przepisem
Następny na liście → Inne wersje → Zobacz więcej przepisów → Podobne → (właściciel) Odśwież / Usuń.

## Design Tokens
Tekst #111827, pomocniczy #374151, akcja #c2410c (hover #9a3412), linki/etykiety #9a3412, separator #e5e7eb, radius kart/zdjęć 4 px, pigułek 999 px.

## Pliki w repo
Strona przepisu (`src/app/przepis/[slug]/`), komponent karty przepisu, sekcje wersji i tagów – znajdź po tekstach „Inne przepisy na” i „Ten przepis jest”.
