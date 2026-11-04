# Zmiana: zdjęcia przy krokach przepisu (dane i import)

Dla Claude Code. Repo `spokospace/zapiszprzepis`. **Wygląd** (lista kroków, lightbox, tryb gotowania) opisuje `ZMIANY_prototyp_klikalny.md` pkt 8a. Ten plik opisuje dane, import i testy.

## 1. Dane
- Tylko część przepisów ma zdjęcia kroków, a w nich tylko część kroków.
- Krok dostaje opcjonalne pole, np. `image: { url, width, height, alt? } | null` (albo tabela `step_images` z `step_index`).
- Import: przy parsowaniu źródła pobieraj zdjęcia przypisane do kroków. Źródłem może być JSON-LD `HowToStep.image` (schema.org Recipe) albo obrazki w bloku kroku w HTML, jak na aniagotuje.pl, przepisy.pl czy poprostupycha.com.pl. Zapisuj kopię w swoim storage, bez hotlinkowania, i generuj warianty 520 px i 1040 px (2x), plus 1600 px dla lightboxa.
- Brak zdjęcia → `null`. Nie wstawiaj zdjęcia głównego jako zastępstwa.

## 2. Ustawienie użytkownika
- „Zdjęcia kroków: Pokaż / Ukryj”, domyślnie „Pokaż”, zapamiętane globalnie (`localStorage` `stepPhotos`; dla zalogowanego opcjonalnie w ustawieniach).
- „Ukryj” zdejmuje zdjęcia z listy kroków i z trybu gotowania. Lightbox jest wtedy niedostępny.

## 3. Obrazy
- Lista: `<img loading="lazy" decoding="async" width height>` wewnątrz `<button>` (pkt 8a), `object-fit: cover`.
- Lightbox: wariant 1600 px, `object-fit: contain` na ciemnym tle.
- `alt`: opis ze źródła, jeśli jest; inaczej „Zdjęcie do kroku {n}”.

## 4. Testy
- Przepis bez zdjęć kroków: brak przełącznika, układ jak dziś.
- Przepis z częścią zdjęć: zdjęcia tylko przy właściwych krokach, bez pustych ramek.
- „Ukryj” → 0 zdjęć na liście i w trybie gotowania; po przeładowaniu dalej ukryte.
- Lightbox: focus na „Zamknij” po otwarciu, Esc zamyka i oddaje focus na zdjęcie, ← → i przyciski przełączają tylko między zdjęciami kroków; przy niskim oknie (np. 440 px) zdjęcie i tekst kroku mieszczą się albo przewijają od góry, bez poziomego scrolla.
- 320 px: brak poziomego przewijania.
- A / A+ / A++: tekst kroku rośnie, zdjęcie bez zmian.
