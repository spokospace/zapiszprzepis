---
change_id: category-browse
title: Przeglądanie przepisów po kategoriach
description: Mama może otworzyć kategorię i zobaczyć tylko przepisy z tej kategorii
author: Szymon
status: implemented
dependencies:
  - S-01 (first-shared-recipe-fb-text)
---

# S-05: Category Browse

## Cel

Mama może otworzyć kategorię (Obiady / Zupy / Desery / Śniadania / Przekąski / Wegetariańskie / Napoje / Inne) i zobaczyć tylko przepisy z tej kategorii — kategoria była przypisana automatycznie przez LLM podczas ekstrakcji w S-01..S-04.

## Wymagania wstępne

- S-01: Complete (schema with category enum, extraction assigns categories)

## Fazy implementacji

### Faza 1: Category selector UI
- Create `src/app/components/category-filter.tsx`:
  - Render 8 category buttons (obiady, zupy, desery, sniadania, przekaski, wegetarianskie, napoje, inne)
  - Active state styling
  - Click handler passes category to parent component (or URL param)
- Add to `/recipes` page above recipe grid

### Faza 2: Category list page — POMINIĘTA (zastąpiona chipsami)
- ~~Create `src/app/(authenticated)/recipes/categories/page.tsx`~~ — nie wdrożone.
- Inline chipsy z Fazy 1 (ikona + licznik per kategoria, na `/recipes`) realizują
  cel „przeglądaj po kategorii" bez osobnej strony-landingu. DoD spełnione bez niej.
- Faza była oznaczona „Optional" — świadomie pominięta.

### Faza 3: Category query + filtering
- Update `src/app/(authenticated)/recipes/page.tsx`:
  - Accept `?category=X` URL param
  - If param present: add WHERE clause `category = X` to Supabase query
  - If no param: show all (current behavior)
- Display active category in UI (breadcrumb or tab)

### Faza 4: Recipe detail → category context
- Update `src/app/(authenticated)/recipes/[slug]/page.tsx`:
  - When viewing recipe, show "Kategoria: Obiady" as badge
  - Optional: add "Więcej z kategorii" link → back to category view

## Checklist testowania

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. ` — <sha>` przy realizacji.
> Zaimplementowane w PR #50 (`50f5e44` filtr+URL param+badge, `7017829`/`8de5176` ikony).

- [x] Build succeeds — 50f5e44
- [x] Category buttons render on /recipes (`CategoryFilter`, chipsy z ikonami + licznikami) — 50f5e44
- [x] Click category → filters recipes (`router.push('/recipes?category=…')`, toggle off na aktywnej) — 50f5e44
- [x] URL param works: /recipes?category=zupy (server-side `eq('category', activeCategory)`) — 50f5e44
- [x] All 8 categories have correct recipe counts (`categoryCounts` z osobnego query) — 50f5e44
- [x] Detail page shows recipe category (badge linkujący do `/recipes?category=X`) — 50f5e44
- [x] Empty state: category with no recipes („Brak przepisów w tej kategorii.") — 50f5e44

## Ryzyka

- **Category consistency**: LLM may assign same recipe differently on re-run (S-05 audit first ~20 recipes)
- **Missing category**: If LLM extraction fails, category defaults to 'inne' — may clutter "Other"

## Open questions

- Should categories be user-customizable (S-02 follow-up) or fixed MVP?
- Icon set for categories — emoji or SVG icons?

## Definition of Done

- PR merged to master
- Category filter on /recipes page working
- All 8 categories filterable
- URL params (?category=X) work
- Recipe detail shows category
- Documented in README (S-05 section)
