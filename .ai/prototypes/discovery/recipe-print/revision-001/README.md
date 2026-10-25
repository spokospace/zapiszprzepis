# Prototyp discovery — wydruk przepisu (revision-001)

Neutralny, klikalny szkielet przepływu drukowania przepisu. Testuje sekwencję,
etykiety, wybory i ścieżki powrotu **zanim** powstanie szczegółowy projekt
wizualny. Działa offline (lokalny HTML/CSS/JS, brak sieci). Dane są fikcyjne.

- Slug: `recipe-print`
- Rewizja: `revision-001` (brak poprzedniej)
- Data: 2026-10-25

## Źródła kontekstu

- Brief decyzyjny: `.ai/specs/briefs/2026-10-25-recipe-print-button.md` (wariant A, jeden
  uniwersalny wydruk, zawartość kartki, non-goals) — status: zaakceptowany przez właściciela 2026-10-25.
- PRD: `context/foundation/prd.md` (przeglądanie przepisu, grupa docelowa obejmująca osoby starsze).
- Reguły projektu (E01): `CLAUDE.md` — czytelność/WCAG, „tylko to co potrzebne”, badge źródła.
- Materiał referencyjny: zrzut ekranu podglądu wydruku WP Recipe Maker, udostępniony przez właściciela w rozmowie.

## Granica symulacji

- **Aktor:** osoba przeglądająca przepis (gość lub zalogowany — drukowanie jest publiczne).
- **Punkt startu:** strona przepisu.
- **Cel (sukces):** użytkownik widzi czystą kartkę gotową do druku (tylko potrzebne treści)
  i uruchamia drukowanie.
- **Ekrany / stany:**
  1. `screen-recipe` — strona przepisu z rzędem akcji („Dodaj do ulubionych”, „Udostępnij”, **„Drukuj”**).
  2. `screen-print` — podgląd wydruku: pasek narzędzi (na ekranie, nie na papierze) + „kartka”
     z zawartością: małe zdjęcie po lewej, obok niego tytuł, podtytuł, porcje i czasy, a niżej
     składniki (z miarą domową) i kroki. **Bez linijki źródła** (decyzja właściciela 2026-10-25:
     źródło nie jest potrzebne na wydruku). Wydruk w produkcji jest dodatkowo zmniejszony
     (kompaktowy), bo ekranowe rozmiary są duże pod czytelność, nie pod papier.
  3. Akcja „Drukuj” na podglądzie → komunikat symulujący otwarcie okna drukowania przeglądarki.
  - Powrót: „← Wróć do przepisu”. Reset: pasek prototypu „↺ Reset”.
- **Miejsca poza zakresem** (reprezentowane uczciwie, nieaktywne z komunikatem): nawigacja nagłówka,
  „Ulubione”, „Udostępnij”, autor; a na stronie przepisu — tryb gotowania, wideo, galeria,
  „inne/podobne przepisy” (świadomie pomijane na wydruku).

## Zachowane decyzje właściciela (nie zmieniać w prototypie)

Źródło: brief 2026-10-25, właściciel. Status: zaakceptowane.

- Wariant **A** — drukowana jest żywa strona przepisu (`window.print()` + arkusz `@media print`);
  **bez** osobnej trasy `/druk`.
- **Jeden** uniwersalny wydruk, **bez** panelu ustawień (bez przełącznika zdjęcia, bez rozmiaru).
- Zawartość kartki: tytuł, krótki opis, porcje, czasy, składniki (+ miary domowe), ponumerowane kroki.
  **Bez linijki źródła** na wydruku (decyzja właściciela 2026-10-25 — zmienia wcześniejszą stopkę ze źródłem).
- Nagłówek na wydruku dwukolumnowy: zdjęcie po lewej, tytuł/porcje/czasy obok (jak desktop).
- Wydruk kompaktowy (zmniejszony), bo ekranowe rozmiary są pod czytelność, nie pod papier.
- **Bez zdjęć kroków.** Zdjęcie okładki zawsze, małe.
- Drukowanie dostępne dla gościa.

## Założenia i dane

- `[ASSUMPTION]` Ekran „podgląd wydruku” w tym prototypie jest **zamiennikiem** natywnego okna
  drukowania przeglądarki. W produkcji (wariant A) „Drukuj” otwiera to okno bezpośrednio — **nie ma**
  dedykowanej trasy podglądu. Ekran podglądu to wyłącznie narzędzie prototypu, by pokazać treść i
  sekwencję kartki; **nie** jest to propozycja dodania trasy `/druk`.
- `[ASSUMPTION]` Dokładny wygląd paska narzędzi podglądu jest poglądowy (inspirowany referencją WPRM),
  służy tylko do przejścia akcji; nie jest wymaganiem.
- `[SYNTHETIC]` Wszystkie dane (przepis „Placki ziemniaczane”, składniki, kroki, źródło) są fikcyjne —
  nie pochodzą z bazy ani z wywiadów.

## Czego ten prototyp NIE dowodzi

Klikalność i akceptacja układu nie dowodzą popytu użytkowników ani nie spełniają Definition of Ready.
To artefakt do rozmowy o sekwencji i treści, nie dowód z użytkownikami i nie projekt wizualny.

## Weryfikacja

Patrz `prototype.json` → `verification`. Sprawdzenie w przeglądarce: otwarcie lokalnego pliku,
przejście „Drukuj” → podgląd → symulacja druku → powrót, oraz komunikaty „poza zakresem”.

## Pliki

- `index.html` — dwa ekrany (przepis, podgląd wydruku), toast.
- `styles.css` — neutralny szkielet (skala szarości), dostępne kontrolki, responsywny.
- `app.js` — przełączanie ekranów, symulacja druku, obsługa „poza zakresem”, reset.
