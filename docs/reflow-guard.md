# Strażnik reflow: 320 px, A++ (WCAG 1.4.10)

`e2e/reflow.spec.ts` sprawdza, czy żaden ekran E01 nie przewija się w poziomie przy szerokości 320 px i największym rozmiarze tekstu (A++ = 1,3, `src/app/components/ui/use-text-scale.ts`). GitHub Actions nie działa, więc strażnika uruchamia się lokalnie przed PR-em, który rusza layout, karty, chipy, nagłówki albo treść przepisu.

## Uruchomienie

```bash
pnpm test:e2e:reflow
```

Playwright sam startuje `next dev` na porcie 3001 (albo używa serwera, który już tam działa). Gdy 3001 jest zajęty przez inną sesję, ustaw inny port. Dev serwer już uruchomiony na tym porcie zostanie użyty:

```bash
E2E_PORT=3241 pnpm test:e2e:reflow
```

Raport HTML: `pnpm exec playwright show-report`.

Ekrany zalogowanego (strona główna, `/dodaj`, `/powiadomienia`, `/settings`, menu) używają konta QA przez `/api/dev/login` ([dev-qa-login.md](dev-qa-login.md)). Potrzebne jest `.env.local` z `DEV_LOGIN_*`, w worktree skopiowane z głównego checkoutu. Bez niego te testy są pomijane (skip), a nie zaliczane. Strażnik niczego nie zapisuje w bazie.

## Co sprawdza

Każdy ekran jest sprawdzany dwa razy:

1. **Na żywych danych**: strona główna (gość i zalogowany), `/szukaj` z długim zapytaniem, przepis, tryb gotowania, `/przepisy/desery`, profil `/u/…`, `/dodaj` (pełny dostęp i bramka kodu), `/powiadomienia`, `/settings`, `/login`, menu (gość i zalogowany). Przepis i profil są wybierane z bieżących wyników wyszukiwania.
2. **Z długą treścią**: do każdego tekstu w `<main>` i w otwartym `<dialog>`, który ma co najmniej 10 znaków i może się zawijać, dopisywany jest długi token bez spacji. Zastępuje on długi tytuł, ilość składnika, nazwę źródła, zapytanie, nazwę użytkownika albo tag.

Test nie przechodzi, gdy `document.scrollWidth > clientWidth` albo gdy przewijany lub przycinany kontener w szufladzie (menu, tryb gotowania) jest szerszy niż jego pole. Celowe przycięcia są pomijane: etykiety `sr-only` i `text-overflow: ellipsis`.

## Gdy test nie przechodzi

Długie słowa łamie reguła bazowa w `src/app/globals.css`: `body { overflow-wrap: anywhere }`. Jest dziedziczona i, w przeciwieństwie do `break-word`, zmniejsza też szerokość min-content, więc elementy flex i grid z długim tokenem się kurczą. Najczęstsze przyczyny regresji:

- `break-words` (Tailwind: `overflow-wrap: break-word`) na elemencie nadpisuje odziedziczone `anywhere` i element znów nie kurczy się w flex/grid. Nie dodawaj go, wystarczy reguła bazowa.
- `whitespace-nowrap` na treści użytkownika. Dopuszczalne tylko na krótkich, stałych etykietach przycisków.
- Element flex z zagnieżdżonym niezawijalnym dzieckiem: dodaj `min-w-0` na elemencie flex.
- Stała szerokość (`w-[…]`, `min-w-[…]`) większa niż 320 px minus marginesy.
- Nowy ekran bez `<main>`: test z długą treścią niczego wtedy nie wydłuża. Każda strona ma landmark `<main>`.

Nowy ekran dopisz do listy `SCREENS` w `e2e/reflow.spec.ts`.
