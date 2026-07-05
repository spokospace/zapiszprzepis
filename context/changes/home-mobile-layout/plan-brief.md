# Home & Recipe Mobile Layout — Krótki plan

> Pełny plan: `context/changes/home-mobile-layout/plan.md`

## Co i dlaczego

Cztery kosmetyczne poprawki responsywności na mobile: za duży padding nad formularzem na home, przyciski CTA nie zawijają się do pełnej szerokości na małych ekranach, hero zdjęcie przepisu staje się portretowe przy powiększonym tekście (bug dostępności), miniaturki kart są kwadratowe zamiast poziomych.

## Punkt wyjścia

`py-12` nie jest responsywne, formularz używa `flex gap-2` bez zawijania, hero image używa `h-96` (rem-based) podatnego na skalowanie tekstu, karty mają `aspect-square`.

## Pożądany stan końcowy

Na telefonach: mniejszy padding, przycisk "Szukaj"/"Dodaj przepis" zajmuje cały wiersz pod polem. Hero zawsze 4:3 (landscape). Karty 4:3 zamiast kwadratowych.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Mobile padding | `py-6 sm:py-12` | Połowa obecnej wartości — wystarczająca redukcja bez ściśnięcia | Plan |
| Breakpoint przycisków | `sm:` (640px) | Obejmuje wszystkie telefony, zero konfiguracji | Plan |
| Układ mikrofonu | Obok inputa, submit pod spodem | Mic pozostaje kontekstualnie blisko pola wpisywania | Plan |
| Hero ratio | `aspect-[4/3] sm:aspect-video` | Mobile 4:3, desktop 16:9 — odporny na rem-scaling, zawsze landscape | Plan |
| Ratio kart | `aspect-[4/3]` | Naturalny format zdjęć jedzenia, więcej treści karty widoczne | Plan |
| Zakres padding fix | Tylko home page | Auth pages mają celową pionową centrację | Plan |

## Zakres

**W zakresie:** `page.tsx` padding, `add-recipe-form.tsx` submit button layout, `recipes/[slug]/page.tsx` hero image, `recipe-card.tsx` thumbnail ratio

**Poza zakresem:** auth pages, mic button position, YouTube iframe, card text layout, `sizes` attribute na miniaturkach

## Architektura / Podejście

Cztery niezależne zmiany klas Tailwind — brak logiki, brak modelu danych. Formularz: form dostaje `flex-col sm:flex-row`, input+mic owijamy w wspólny div, submit dostaje `w-full sm:w-auto`. Hero i karty: wymiana `h-96`/`aspect-square` na `aspect-[4/3]`.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Responsive Tailwind Fixes | Wszystkie 4 zmiany w jednej sesji | Desktop regresja — form layout lub hero height |

**Wymagania wstępne:** brak  
**Szacowany nakład pracy:** ~1 sesja, 1 faza

## Otwarte ryzyka i założenia

- Hero `sm:aspect-video` na desktop (max-width 672px) daje ~378px wysokości — podobne do poprzedniego `h-96 = 384px`, więc zmiana jest minimalna

## Kryteria sukcesu (podsumowanie)

- Submit button pełna szerokość na telefonie, formularz inline na desktop/tablet
- Hero image landscape na telefonie z powiększonym tekstem
- Karty 4:3 zamiast kwadratowych
