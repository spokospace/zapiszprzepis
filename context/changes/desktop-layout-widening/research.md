---
date: 2026-07-06T01:52:00+02:00
researcher: Szymon
git_commit: 631c0eef714bc4eac06a02cb8625dc1946cf25eb
branch: readme-screenshots
repository: zapiszprzepis
topic: "Desktop layout widening — źródła ograniczeń szerokości kontenerów"
tags: [research, layout, responsive, tailwind, desktop]
status: complete
last_updated: 2026-07-06
last_updated_by: Szymon
---

# Research: Desktop layout widening

**Date**: 2026-07-06T01:52:00+02:00
**Researcher**: Szymon
**Git Commit**: 631c0eef714bc4eac06a02cb8625dc1946cf25eb
**Branch**: readme-screenshots
**Repository**: zapiszprzepis

## Research Question

Widok desktopowy wyświetla zawartość w zbyt wąskim kontenerze (624px oraz 768px). Zbadaj skąd pochodzi każde ograniczenie, jak zbudowany jest layout aplikacji i które widoki wymagają zmian.

## Summary

Aplikacja nie ma żadnego wspólnego komponentu wrapper ani centralnego kontenera — każda strona definiuje własną szerokość inline. Hierarchia trzech różnych max-width jest niespójna: header i lista przepisów używają `max-w-6xl` (1152px), ale strona główna i detail przepisu są znacznie węższe. Naprawienie desktop view wymaga zmian w dokładnie 2 plikach.

## Detailed Findings

### Źródło 624px — strona główna (`/`)

- **Plik**: [`src/app/page.tsx:33`](https://github.com/spokospace/zapiszprzepis/blob/631c0eef714bc4eac06a02cb8625dc1946cf25eb/src/app/page.tsx#L33)
- **Klasa**: `mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12`
- **Mechanizm**: `max-w-2xl` = 672px szerokości kontenera. Na ekranach ≥640px wchodzi `sm:px-6` (padding 24px z każdej strony = 48px łącznie), co daje **624px widocznej treści**.
- **Uwaga**: Ta strona renderuje własny `<AppHeader>` bezpośrednio (nie przez authenticated layout), więc jest całkowicie niezależna.

### Źródło 768px — szczegóły przepisu (`/recipes/[slug]`)

- **Plik**: [`src/app/(authenticated)/recipes/[slug]/page.tsx:95`](https://github.com/spokospace/zapiszprzepis/blob/631c0eef714bc4eac06a02cb8625dc1946cf25eb/src/app/(authenticated)/recipes/%5Bslug%5D/page.tsx#L95)
- **Klasa**: `max-w-3xl mx-auto px-4 sm:px-6 lg:px-8`
- **Mechanizm**: `max-w-3xl` = 768px — twardy limit szerokości kontenera na każdym desktopu.
- **Uwaga**: Wewnątrz jest grid `md:grid-cols-2` (składniki + instrukcje) — rozszerzenie kontenera wymaga weryfikacji, czy ten grid nadal wygląda dobrze.

### Widoki już szerokie (bez problemu)

- **Header**: [`src/app/components/app-header.tsx:19`](https://github.com/spokospace/zapiszprzepis/blob/631c0eef714bc4eac06a02cb8625dc1946cf25eb/src/app/components/app-header.tsx#L19) — `max-w-6xl` (1152px) ✓
- **Lista przepisów**: [`src/app/(authenticated)/recipes/recipes-content.tsx:50`](https://github.com/spokospace/zapiszprzepis/blob/631c0eef714bc4eac06a02cb8625dc1946cf25eb/src/app/(authenticated)/recipes/recipes-content.tsx#L50) — `max-w-6xl` (1152px), grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ✓

### Architektura layoutu

Brak centralnego kontenera / wrapper komponentu:
- `src/app/layout.tsx` — shell (`<html>`, `<body>`), brak max-width
- `src/app/(authenticated)/layout.tsx` — renderuje `<AppHeader>` + `{children}`, brak max-width
- Każda strona ustawia własną szerokość inline

Brak pliku `tailwind.config.ts/js`. Projekt używa Tailwind v4 (CSS-first config via `@import "tailwindcss"` w `globals.css`). Brak custom breakpointów ani custom container sizes.

### Strony auth

`login`, `signup`, `forgot-password`, `reset-password` — brak `max-w-*` na wrapperze, centrowanie przez flexbox. Formularz wewnątrz (`w-full max-w-sm`) jest celowo wąski — to nie problem desktopowy.

## Code References

- `src/app/page.tsx:33` — `max-w-2xl` źródło 624px
- `src/app/(authenticated)/recipes/[slug]/page.tsx:95` — `max-w-3xl` źródło 768px
- `src/app/(authenticated)/recipes/[slug]/page.tsx:148` — `grid md:grid-cols-2` wewnętrzny grid (uwzględnić przy rozszerzaniu)
- `src/app/(authenticated)/recipes/recipes-content.tsx:50` — `max-w-6xl` wzorzec do naśladowania
- `src/app/components/app-header.tsx:19` — `max-w-6xl` wzorzec do naśladowania

## Architecture Insights

**Wzorzec padding**: Wszystkie szerokie elementy używają tego samego responsive padding: `px-4 sm:px-6 lg:px-8`. Wąskie strony mają tylko `px-4 sm:px-6` (bez `lg:px-8`). Przy rozszerzaniu należy dododać `lg:px-8`.

**Spójność**: Logiczne docelowe szerokości:
- Strona główna (`/`): powinna pasować do headera → `max-w-6xl`
- Detail przepisu: tekst do czytania — `max-w-4xl` (896px) lub `max-w-5xl` (1024px) zamiast `max-w-6xl`, ale z pełnym responsive paddingiem

**Brak shared containera**: Każda zmiana to 1 div w 1 pliku — prosta operacja, ale też brak single-source-of-truth jeśli w przyszłości pojawią się nowe strony.

## Historical Context

- `context/changes/home-mobile-layout/` — poprzednia praca na mobile: spacing, button width, hero aspect ratio. **Nie było zmian desktopowych.**
- `context/changes/uix-changes/` — ogólne UI fixes. Brak zmian szerokości kontenerów.
- Brak precedensu dla desktop layout widening w archiwum.

## Implementation (2026-07-06)

Wszystkie pytania rozstrzygnięte i zaimplementowane w tym samym commicie (`c0586ae`).

### Rozstrzygnięcia

1. **Recipe detail width**: wybrano `max-w-5xl` (1024px) — weryfikacja wizualna przy 1440px potwierdziła, że 2-kolumnowy grid składniki/przygotowanie wygląda proporcjonalnie, obraz hero jest duży i czytelny.
2. **Strona główna grid**: `grid-cols-2 sm:grid-cols-3` przy `max-w-6xl` wygląda dobrze — karty w sekcji "Ostatnio dodane" są wystarczająco duże, dodatkowy breakpoint `lg:grid-cols-4+` nie był potrzebny.
3. **Shared container**: zaimplementowany jako `PageContainer` z prop `narrow` (max-w-5xl) i domyślnym (max-w-6xl). Podczas simplify review AppHeader również został przepisany na `PageContainer`, eliminując jedyne miejsce gdzie `max-w-6xl` było zdublowane.

### Zmiany

| Plik | Zmiana |
|---|---|
| `src/app/components/page-container.tsx` | nowy komponent |
| `src/app/layout.tsx` | `max-w-screen-2xl` na `<body>` (cap ultrawide) |
| `src/app/page.tsx` | `max-w-2xl` → `PageContainer` |
| `src/app/(authenticated)/recipes/recipes-content.tsx` | `max-w-6xl` → `PageContainer` |
| `src/app/(authenticated)/recipes/[slug]/page.tsx` | `max-w-3xl` → `PageContainer narrow` |
| `src/app/components/app-header.tsx` | inline div → `PageContainer` (simplify finding) |
