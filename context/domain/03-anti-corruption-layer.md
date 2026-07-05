---
created: 2026-07-06
leak: Database (Supabase generated types) wyciekające do warstwy UI i domenowej
priority: #2 z 01-domain-distillation.md (score 6/9)
---

# Warstwa Anti-Corruption (ACL) — Izolacja typów Supabase

## Która zależność wycieka i przez ile warstw

Wygenerowany typ `Database` z `src/lib/supabase.types.ts` (plik generowany przez `supabase gen types typescript`) jest importowany **bezpośrednio w warstwie UI i domenowej**, bez pośredniej warstwy mapowania:

| Plik importujący | Warstwa | Linia | Co importuje |
|-----------------|---------|-------|-------------|
| `src/app/(authenticated)/recipes/page.tsx` | UI (RSC) | 4, 6-7 | `Database`, `Constants` — `type Recipe = Database['public']['Tables']['recipes']['Row']` |
| `src/app/(authenticated)/recipes/recipes-content.tsx` | UI (Client Component) | 8, 10-11 | `Database` — `type Recipe = Database['public']['Tables']['recipes']['Row']` |
| `src/app/(authenticated)/recipes/[slug]/page.tsx` | UI (RSC) | 11, 23 | `Database` — `type Recipe = Database['public']['Tables']['recipes']['Row']` |
| `src/lib/recipe-categories.ts` | Domena (helper) | 1, 3 | `Database` — `type RecipeCategory = Database['public']['Enums']['recipe_category']` |
| `src/lib/failed-shares.ts` | Aplikacja | 2 (pośrednio) | przez `createSupabaseServerClient` — nie `Database` bezpośrednio |

Każda zmiana schematu Supabase (zmiana nazwy kolumny, dodanie pola, zmiana enuma) natychmiast propaguje się do komponentów UI — wymagając zmian w warstwie prezentacji, która nie powinna nic wiedzieć o szczegółach persystencji.

---

## Komenda grep potwierdzająca wyciek

```bash
grep -rn "from.*supabase.types" src/
```

Wynik (z analizy kodu):
```
src/lib/recipe-categories.ts:1:  import type { Database } from '@/lib/supabase.types'
src/app/(authenticated)/recipes/page.tsx:4:  import { Constants, type Database } from '@/lib/supabase.types'
src/app/(authenticated)/recipes/recipes-content.tsx:8:  import type { Database } from '@/lib/supabase.types'
src/app/(authenticated)/recipes/[slug]/page.tsx:11:  import type { Database } from '@/lib/supabase.types'
```

Po prawidłowej refaktoryzacji `grep -rn "from.*supabase.types" src/` powinien zwracać **tylko pliki w warstwie adaptera** (np. `src/lib/supabase/` i `src/adapters/recipe-repository.ts`).

---

## Proponowana ACL: Value Object + Port + wzorzec Adapter

### Krok 1 — Domenowe Value Object (niezależne od Supabase)

```typescript
// src/domain/recipe.ts  (pseudokod)

export type RecipeCategory =
  | 'obiady' | 'zupy' | 'desery' | 'sniadania'
  | 'przekaski' | 'salatki' | 'napoje' | 'inne'

export type RecipeSourceLabel =
  | 'Facebook' | 'Blog' | 'YouTube' | 'Inne'

export interface RecipeCard {
  id: number
  slug: string
  title: string
  imageUrl: string | null
  category: RecipeCategory
}

export interface RecipeDetail extends RecipeCard {
  description: string | null
  ingredients: Ingredient[]
  steps: string[]
  sourceLabel: RecipeSourceLabel
  sourceUrl: string | null
  youtubeId: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  totalTimeMinutes: number | null
}
```

### Krok 2 — Port (interfejs bez implementacji)

```typescript
// src/domain/recipe-repository.ts  (pseudokod)

export interface RecipeRepository {
  listCards(userId: string, opts: { category?: RecipeCategory; q?: string }): Promise<RecipeCard[]>
  getDetail(userId: string, slug: string): Promise<RecipeDetail | null>
  getCategoryCounts(userId: string): Promise<Partial<Record<RecipeCategory, number>>>
}
```

### Krok 3 — Adapter (jedyne miejsce znające Supabase)

```typescript
// src/adapters/supabase-recipe-repository.ts  (pseudokod)

import type { Database } from '@/lib/supabase.types'  // ← jedyny dozwolony import Database poza lib/supabase/

type DbRecipe = Database['public']['Tables']['recipes']['Row']

function toRecipeCard(row: DbRecipe): RecipeCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    imageUrl: row.image_url,
    category: row.category as RecipeCategory,
  }
}

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private supabase: SupabaseClient) {}

  async listCards(userId: string, opts) {
    const { data } = await this.supabase
      .from('recipes')
      .select('id, slug, title, image_url, category')
      // ...filtrowanie
    return (data ?? []).map(toRecipeCard)
  }
}
```

---

## Kryterium sukcesu

Po refaktoryzacji uruchomienie:

```bash
grep -rn "from.*supabase.types" src/
```

zwraca **wyłącznie** pliki w ścieżkach:
- `src/lib/supabase/` (klienty Supabase)
- `src/adapters/` (implementacja repozytorium)
- `src/lib/supabase.types.ts` (sam plik — definicja, nie import)

Pliki UI (`src/app/**`) i domenowe (`src/domain/**`, `src/lib/recipe-categories.ts`) **nie pojawiają się** w wynikach grep.

---

## Priorytetyzacja wdrożenia

Refaktoryzacja nie jest blocking dla S-04/S-05/S-06 (scale jest mały — ~100 przepisów, jeden użytkownik). Wdrożyć jako dedykowane zadanie **po** zakończeniu backlogu MVP, zanim pojawi się drugi użytkownik lub pierwsza migracja schematu wymagająca zmian w UI. Czas wdrożenia: 2-4h (adaptery dla `listCards` + `getDetail` + testy).
