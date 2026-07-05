---
created: 2026-07-06
invariant: A4 — Przepis musi zawierać tytuł + składniki + kroki (na wszystkich ścieżkach)
priority: #1 z 01-domain-distillation.md (score 9/9)
---

# Refaktoryzacja Agregatu — Inwariant A4: Przepis musi być kompletny

## Czym jest ten inwariant (w języku biznesowym)

Każdy zapisany przepis musi zawierać co najmniej: **tytuł w języku polskim**, **niepustą listę składników** i **niepuste ponumerowane kroki**. Przepis bez treści narusza zasadę *archive-first* — mamie wyświetliłby się przepis z tytułem i pustą kartą, co jest gorsze niż brak przepisu (stracony czas, brak zaufania do aplikacji).

---

## Gdzie jest obecnie egzekwowany (diagnoza)

Inwariant jest **rozproszony po 3 ścieżkach**, z których tylko 2 go faktycznie egzekwują:

| Ścieżka | Plik:linia | Egzekwuje? | Uwaga |
|---------|-----------|-----------|-------|
| Normalna ekstrakcja (insert) | `run-extract-recipe.ts:206` | Tak | `isExtractedRecipeUsable(recipeJSON)` wywołane przed insertem |
| Force refresh ("Odśwież przepis") | `run-extract-recipe.ts:214-249` | **NIE** | Blok `if (forceRefresh)` zaczyna się przed sprawdzeniem usability; walidacja jest w tym bloku pominięta |
| Gap-fill (dedup — URL już istnieje) | `run-extract-recipe.ts:303-344` | N/A | Nie nadpisuje title/ingredients/steps — tylko wypełnia `null` pola czasowe; inwariant naturalnie zachowany |

Sama funkcja `isExtractedRecipeUsable` jest czysta i dobrze zdefiniowana (`content-quality.ts:37-46`), ale jej wiring jest niekompletny.

**Brak ochrony na poziomie bazy danych:** kolumny `ingredients` i `steps` mają typ `jsonb` bez `CHECK` constraint wymuszającego niepustą tablicę. DB nie cofnęłaby nieprawidłowego `UPDATE`.

---

## Proponowany projekt Aggregate Root

Zamiast rozproszonych wywołań `isExtractedRecipeUsable`, wprowadź Value Object `ValidatedRecipeContent` który nie może zostać skonstruowany bez spełnienia inwariantu.

```typescript
// src/domain/recipe-content.ts  (pseudokod — nie kod produkcyjny)

/** Value Object: niezmutowalna, zwalidowana treść przepisu.
 *  Nie można go skonstruować z pustymi składnikami lub krokami.
 */
export class ValidatedRecipeContent {
  readonly title: string          // niepusty string po .trim()
  readonly ingredients: Ingredient[]  // length >= 1
  readonly steps: string[]        // length >= 1
  readonly category: RecipeCategory
  // ...pola opcjonalne (czasy, youtube_id)

  private constructor(data: RecipeData) {
    this.title = data.title
    this.ingredients = data.ingredients
    this.steps = data.steps
    this.category = data.category
  }

  static create(data: RecipeData): ValidatedRecipeContent {
    if (!data.title?.trim()) throw new RecipeValidationError('Brak tytułu przepisu')
    if (!data.ingredients?.length) throw new RecipeValidationError('Brak składników')
    if (!data.steps?.length) throw new RecipeValidationError('Brak kroków')
    if (!VALID_CATEGORIES.has(data.category)) throw new RecipeValidationError('Nieprawidłowa kategoria')
    return new ValidatedRecipeContent(data)
  }
}

/** Wywoływany przez każdą ścieżkę zapisu (insert + force refresh): */
function persistRecipe(
  supabase: SupabaseClient,
  content: ValidatedRecipeContent,  // nie RecipeData — wymusza przejście przez create()
  ...
): Promise<{ id: number }>
```

---

## Przed / po dla każdego punktu egzekwowania

### Ścieżka 1: Normalna ekstrakcja (insert)

**Przed** (`run-extract-recipe.ts:197-209`):
```typescript
const recipeJSON = JSON.parse(content) as RecipeData
if (!recipeJSON.title ...) throw ...
if (!isExtractedRecipeUsable(recipeJSON)) throw ...
// ... 50 linii dalej: supabase.from('recipes').insert(...)
```

**Po**:
```typescript
const content = ValidatedRecipeContent.create(JSON.parse(raw))  // rzuca jeśli invalid
// ...
await persistRecipe(supabase, content, ...)  // tylko ValidatedRecipeContent dopuszczony
```

### Ścieżka 2: Force refresh ("Odśwież przepis")

**Przed** (`run-extract-recipe.ts:214` — brak walidacji):
```typescript
if (forceRefresh) {
  // ← isExtractedRecipeUsable() NIGDY NIE JEST WYWOŁYWANE
  await supabase.from('recipes').update({ title: recipeJSON.title, ... })
```

**Po** (walidacja wymagana zanim wejdzie się w blok forceRefresh):
```typescript
const content = ValidatedRecipeContent.create(recipeJSON)  // rzuca jeśli invalid
if (forceRefresh) {
  await persistRecipe(supabase, content, { mode: 'refresh', recipeId: existing.id })
```

---

## Fazy refaktoryzacji (test-first)

### Faza 1 — Pokrycie istniejącej logiki testami (bez zmian w kodzie)
- Napisać testy jednostkowe dla `isExtractedRecipeUsable` pokrywające: puste `ingredients`, puste `steps`, `null` values, puste stringi w title.
- Napisać test integracyjny `run-extract-recipe` dla ścieżki `force refresh` z mockowaną odpowiedzią LLM bez składników — udokumentować że test **przechodzi** (tzn. że inwariant jest naruszony).

### Faza 2 — Dodanie `ValidatedRecipeContent` jako Value Object
- Stworzyć `src/domain/recipe-content.ts` z klasą `ValidatedRecipeContent.create()`.
- Zamienić wywołania `isExtractedRecipeUsable` na `ValidatedRecipeContent.create()` — unit testy zielone.
- Zaktualizować `persistRecipe` (nowa pomocnicza funkcja) by przyjmowała tylko `ValidatedRecipeContent`.

### Faza 3 — Wpięcie do ścieżki force refresh
- Dodać `ValidatedRecipeContent.create()` na początku bloku `if (forceRefresh)` w `run-extract-recipe.ts`.
- Uruchomić testy integracyjne z Fazy 1 — test "force refresh bez składników" powinien teraz **nie przejść** (poprawnie rzuca wyjątek).

### Faza 4 — DB-level guard (opcjonalna, long-term)
- Dodać migrację Supabase: `ALTER TABLE recipes ADD CONSTRAINT ingredients_not_empty CHECK (jsonb_array_length(ingredients) > 0)`.
- Analogicznie dla `steps`.
- Zaktualizować `supabase.types.ts` przez `supabase gen types`.
- Traktować jako ostatnią linię obrony, nie jako substytut warstwy aplikacji.
