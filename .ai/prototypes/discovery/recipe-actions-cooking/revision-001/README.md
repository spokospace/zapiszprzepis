# Prototyp discovery — rząd akcji + „Tryb gotowania" (nowy układ, revision-001)

Klikalny prototyp przeprojektowanego fragmentu strony przepisu: rzędu akcji
(serce / Udostępnij / Drukuj) i przycisku „Tryb gotowania". Testuje układ,
etykiety i sekwencję na desktopie i telefonie **zanim** powstanie kod. Działa
offline (lokalny HTML/CSS/JS). Dane fikcyjne. Styl zbliżony do aplikacji
(pomarańcz #c2410c, ciemny #111827, pigułki), bo decyzja dotyczy realnego układu.

- Slug: `recipe-actions-cooking`
- Rewizja: `revision-001` (brak poprzedniej)
- Data: 2026-10-25

## Źródła kontekstu

- Rozmowa (ta sesja): dwa tematy zgłoszone przez właściciela — „Drukuj nie mieści się dobrze w 1 linii"
  oraz „Tryb gotowania niepotrzebnie na pełną szerokość na desktopie".
- `CLAUDE.md` (reguły E01): **ikony zawsze z podpisem** (wyjątek: serce na zdjęciu karty), WCAG 2.2 AA,
  cele ≥ 48 px / główny 56 px, tokeny (pomarańcz z białym tekstem = `#c2410c`), grupa docelowa obejmuje
  osoby starsze (prostota i czytelność).
- Scalony PR #527 (druk): obecny rząd akcji (serce + Udostępnij + Drukuj) i jego dwuliniowy układ.
- `src/app/przepis/[slug]/_components/recipe-actions.tsx`, `cooking-mode.tsx`, `recipe-checklists.tsx` —
  stan obecny, który ten prototyp zastępuje wizualnie.

## Granica symulacji

- **Aktor:** osoba przeglądająca przepis (gość lub zalogowany).
- **Punkt startu:** strona przepisu.
- **Cel:** jasno i prosto wybrać akcję (ulubione / udostępnij / drukuj) albo wejść w tryb gotowania,
  bez ściskania i zgadywania — także dla starszych osób.
- **Ekrany / stany:**
  1. Strona przepisu — desktop i telefon (przełącznik na pasku prototypu).
  2. Nakładka trybu gotowania (uproszczona, 4 kroki, „← Wstecz" / „Dalej →" / „✕ Zakończ").
  - Interakcje: serce wł/wył (pomarańczowe wypełnienie + toast), Udostępnij/Drukuj (toast-symulacja),
    tryb gotowania (otwarcie/nawigacja/zamknięcie), reset, przełącznik Desktop/Telefon.

## Decyzje właściciela (potwierdzone w tej rozmowie)

- „Tryb gotowania" na desktopie: **zwięzły przycisk auto, wyrównany do lewej** nad kolumnami (nie na pełną
  szerokość). Na telefonie bez zmian (pełna szerokość). — wybrane przez właściciela.

## Założenia (do zatwierdzenia — nie są jeszcze wymaganiem)

- `[ASSUMPTION]` Rząd akcji jako **trzy równe, podpisane przyciski w jednej linii na pełną szerokość treści**
  (desktop); na telefonie **serce na pełną szerokość, a Udostępnij + Drukuj jako mniejsza para obok siebie**
  (mniej szumu, krótszy blok przed przepisem). To moja propozycja na prośbę „zasugeruj coś, prosto i intuicyjnie".
  Wymaga akceptacji właściciela. **Nadpisywałaby** notkę #494 (akcje na szerokość treści, nie rozciągane) —
  świadomie, na rzecz czytelności dla starszych osób; zmiana reguły wymaga zgody właściciela.
- `[ASSUMPTION]` Ikony w przyciskach są poglądowe; w aplikacji używamy ikon `lucide` z widoczną etykietą
  (zgodnie z regułą „ikony zawsze z podpisem").
- `[SYNTHETIC]` Wszystkie dane (Zupa buraczkowa, składniki, kroki) są fikcyjne.

## Czego ten prototyp NIE dowodzi

Klikalność i akceptacja układu nie dowodzą popytu użytkowników ani nie spełniają Definition of Ready.
To artefakt do decyzji o układzie, nie dowód z użytkownikami.

## Weryfikacja

`Verification: passed` — sprawdzone w przeglądarce (serwowane lokalnie po HTTP): desktop (trzy równe
przyciski w jednej linii + zwięzły tryb gotowania do lewej), telefon (akcje w kolumnie, tryb gotowania
na pełną szerokość), nakładka trybu gotowania (otwarcie → krok 1/4 → zamknięcie → powrót), serce wł
(pomarańczowe + toast). Brak błędów konsoli w trakcie przejścia.

## Pliki

- `index.html` — strona przepisu (nowy układ) + nakładka trybu gotowania + toast.
- `styles.css` — style zbliżone do aplikacji; układy desktop/telefon przez klasę na `#stage`.
- `app.js` — przełącznik widoku, serce, toasty, nakładka trybu gotowania, reset.
