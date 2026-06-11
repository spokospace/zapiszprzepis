# Recipe detail page — prep time and additional media (Phase 1) plan implementacji

## Przegląd

Detail page przepisu nie pokazuje czasów (przygotowanie / gotowanie / łącznie). Plan dodaje 3 osobne pola typu `int minutes` (zgodne z schema.org Recipe vocabulary), rozszerza prompt OpenAI o ich ekstrakcję, renderuje czytelny po polsku format („1 godz 30 min") z ikonami nad sekcją Składników, i refreshuje istniejące przepisy żeby też miały te dane.

**Uwaga zakresu:** „dodatkowe media" (gallery, YouTube embed) jest poza scope'em tej zmiany. YouTube embed pasuje do S-04 youtube-recipe-source (proposed w roadmap). Gallery wymaga zmian w Firecrawl options i osobnej decyzji o storage — osobny issue.

## Analiza stanu obecnego

- Schema `recipes` nie ma żadnych pól czasu (`supabase/migrations/20260607000000_recipe_schema.sql:33-50`).
- OpenAI prompt w `src/inngest/functions.ts:62-74` nie pyta o czasy. `RecipeData` interface (`src/inngest/functions.ts:16-22`) nie ma pól czasu.
- Detail page renderuje title / image / ingredients / steps (`src/app/(authenticated)/recipes/[slug]/page.tsx:62-148`). Nie ma sekcji metadata typu czas / porcje.
- Inngest function ma już insert-with-slug-retry + URL-collision branch (z recipe-url-dedup Phase 3) → URL-collision branch obecnie tylko podpina existing recipe do share'a. Można rozszerzyć żeby też wypełniał luki.
- Istniejący 1 przepis (Tortilla z patelni) ma wszystkie 3 pola czasu null po migracji (kolumny nullable).

## Pożądany stan końcowy

Po wdrożeniu:
- Każdy nowy przepis wyekstrahowany przez Firecrawl + OpenAI ma `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes` (każde nullable jeśli AI nie znalazł).
- Detail page pokazuje sekcję czasów (ikony + format „1 godz 30 min") nad/przy Składnikach. Renderuje tylko te pola które nie są null. Jeśli wszystkie 3 null — sekcja całkowicie ukryta.
- Skrypt `scripts/refresh-recipe-times.ts` uruchomiony jednorazowo po deployu wypełnia czasy istniejących przepisów (obecnie: 1 przepis).
- Inngest URL-collision branch wypełnia null fields istniejącego przepisu danymi z nowej ekstrakcji.

### Kluczowe odkrycia

- Standard schema.org Recipe → `prepTime` + `cookTime` + `totalTime` (3 osobne) ułatwia przyszłe SEO Rich Results. `total != prep + cook` (passive time np. marynowanie) — uzasadnia 3 osobne pola.
- Inngest function ma już sophisticated insert loop — nie chcemy zepsuć URL-collision branch (`src/inngest/functions.ts` po Phase 3 recipe-url-dedup). Rozszerzenie tej branch musi zachować obecne zachowanie (link share do existing recipe) i tylko DODAĆ update-gaps.
- Lesson [centralize env reads in lib/env.ts](file:///C:/Users/spoko/www/zapiszprzepis/context/foundation/lessons.md#L64-L72) — wzorzec dla małych helperów (`format-minutes.ts` jako pure function).

## Czego NIE robimy

- Gallery / multi-image extraction (osobna zmiana, wymaga adjustowania Firecrawl options)
- YouTube embed (część S-04 youtube-recipe-source)
- `performTime` ze schema.org (nowszy field, rzadko używany w praktyce)
- Servings / yield (osobny scope)
- Manual edycja czasów w UI (przeciwne PRD §Non-Goals „zero data entry")
- Schema.org JSON-LD na detail page dla SEO (osobny issue, zależy też od adresowania)

## Podejście do implementacji

Trzy fazy następujące po sobie, każda samodzielnie shippable:

1. **Schema + extraction (Phase 1)** — nullable kolumny w DB, AI prompt updated, nowe pola w `RecipeData`. Nowe przepisy zaczynają mieć czasy.
2. **Render (Phase 2)** — formatter helper, sekcja na detail page. Czasy widoczne.
3. **Bulk refresh (Phase 3)** — Inngest update-gaps semantics + jednorazowy skrypt. Stare przepisy podciągnięte.

Każda faza weryfikowana niezależnie. Phase 2 mogłaby trafić bez Phase 1 (render działa pusto), ale lepiej w tej kolejności.

## Faza 1: Schema + extraction

### Przegląd

Dodaj 3 nullable kolumny `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes` (`int`) do tabeli `recipes`. Zaktualizuj OpenAI prompt w `src/inngest/functions.ts` żeby zwracał te pola. Zaktualizuj `RecipeData` interface i mapowanie do insertu.

### Wymagane zmiany

#### 1. Schema migration

**Plik**: `supabase/migrations/<TIMESTAMP>_recipe_times.sql` (nowy — użyj `date -u +%Y%m%d%H%M%S`)

**Cel**: Dodać 3 nullable kolumny do `public.recipes`. Nie pre-fillować istniejących wierszy (zrobi to Phase 3 przez Inngest).

**Kontrakt**: `alter table public.recipes add column prep_time_minutes int`, podobnie `cook_time_minutes` i `total_time_minutes`. Każda nullable bez default. Komentarze SQL opisujące że to czas w minutach.

#### 2. OpenAI prompt + RecipeData

**Plik**: `src/inngest/functions.ts`

**Cel**: Rozszerzyć system prompt OpenAI o 3 pola czasu. Rozszerzyć `RecipeData` interface o `prepTimeMinutes?`, `cookTimeMinutes?`, `totalTimeMinutes?` (number | null). Insert do `recipes` dodaje te 3 pola.

**Kontrakt**: 
- System prompt JSON structure dodaje: `"prepTimeMinutes": "active prep time in minutes as integer, or null if unknown", "cookTimeMinutes": "...", "totalTimeMinutes": "..."`
- Rules dodaje: „total_time includes passive time (marinating, resting, cooling); prep+cook may not sum to total"
- `RecipeData` interface gets 3 optional `number | null` fields
- Insert object dodaje `prep_time_minutes: recipeJSON.prepTimeMinutes ?? null` (i analogicznie) — explicit null żeby zachować nullable semantics

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`
- Migration aplikuje się: `pnpm exec supabase db push`
- ESLint przechodzi (brak nowych warnings na zmienionych plikach): `pnpm exec eslint src/inngest/functions.ts`

#### Weryfikacja ręczna

- Po migracji `select column_name, data_type, is_nullable from information_schema.columns where table_name='recipes' and column_name like '%_time_minutes'` pokazuje 3 wiersze, każdy `integer`, `YES` (nullable)
- Po deployu: udostępnij nowy URL przepisu z bloga zawierającego czasy (np. mecooks tortilla — sprawdzi przy okazji ile pól AI zwrócił), poczekaj na Inngest run, sprawdź w bazie `select title, prep_time_minutes, cook_time_minutes, total_time_minutes from recipes order by id desc limit 1`

**Uwaga implementacyjna**: Po zakończeniu fazy zatrzymaj się na manual confirmation.

---

## Faza 2: Render

### Przegląd

Helper `format-minutes.ts` zamieniający int na czytelny po polsku ciąg („1 godz 30 min"). Sekcja czasów na detail page z ikonami nad sekcją Składników. Pokaż tylko fields które nie są null.

### Wymagane zmiany

#### 1. Pure formatter helper

**Plik**: `src/lib/format-minutes.ts` (nowy)

**Cel**: Wystawić `formatMinutes(minutes: number): string` jako pure function. Konwersja: `< 60` → „X min", `>=60` i `% 60 === 0` → „X godz", inaczej „X godz Y min".

**Kontrakt**: `formatMinutes(90) === '1 godz 30 min'`, `formatMinutes(45) === '45 min'`, `formatMinutes(120) === '2 godz'`, `formatMinutes(0) === '0 min'`. Throw / undefined behavior dla ujemnych — caller nie powinien przekazywać.

#### 2. Times section na detail page

**Plik**: `src/app/(authenticated)/recipes/[slug]/page.tsx`

**Cel**: Dodać sekcję czasów (3 badge'y z ikonami: Clock dla prep, Flame dla cook, Timer dla total — z lucide-react). Pokaż tylko te badge'y które mają wartość != null. Cała sekcja ukryta gdy wszystkie 3 null.

**Kontrakt**: 
- Import z `lucide-react`: `Clock`, `Flame`, `Timer` (lub równoważne)
- Import `formatMinutes` z `@/lib/format-minutes`
- Renderuj sekcję między `<h1>{title}</h1>` blockiem a sekcją Składników (lub w bloku metadata obok category badge — uzgodnij wizualnie z istniejącym layoutem)
- Conditional render: `{(prep || cook || total) && <section>...badge'y...</section>}`
- Labelki PL: „Przygotowanie", „Gotowanie", „Łącznie"

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`
- ESLint przechodzi na zmienionych plikach: `pnpm exec eslint src/lib/format-minutes.ts "src/app/(authenticated)/recipes/[slug]/page.tsx"`

#### Weryfikacja ręczna

- Otwórz detail page przepisu który MA czasy → widoczne badge'y z ikonami i poprawnym formatem PL
- Otwórz detail page przepisu który NIE ma czasów (np. po backfillu istniejącego przepisu jeśli AI nie znalazł) → sekcja ukryta
- Zmień jedno z pól na null w bazie ręcznie, odśwież → ten badge nie pokazuje się, pozostałe widoczne

**Uwaga implementacyjna**: Po zakończeniu fazy zatrzymaj się na manual confirmation.

---

## Faza 3: Bulk refresh existing recipes

### Przegląd

Rozszerz Inngest URL-collision branch żeby wypełniał luki (gdy istniejący przepis ma null w polu, ale nowa ekstrakcja zwróciła wartość, wypełnij). Dodaj jednorazowy skrypt `scripts/refresh-recipe-times.ts` który wyzwala Inngest event dla każdego przepisu z brakującymi czasami.

### Wymagane zmiany

#### 1. Inngest function: update-gaps w URL collision branch

**Plik**: `src/inngest/functions.ts`

**Cel**: Gdy insert do `recipes` zwraca `recipes_user_source_url_uniq` violation i lookup zwraca existing recipe, NOWE zachowanie: zrób `update existing recipe` ustawiając pola na nowe wartości TYLKO tam gdzie istniejące to null (gap-fill semantics). Zachowaj obecne zachowanie linkowania share'a do existing recipe.

**Kontrakt**:
- W URL-collision branch (`src/inngest/functions.ts` po Phase 3 recipe-url-dedup), po znalezieniu existing recipe:
  1. Skonstruuj update payload — dla każdego pola czasu z RecipeData, jeśli existing recipe ma null AND nowa ekstrakcja zwróciła wartość, dołącz do update
  2. Jeśli update payload nie jest pusty: `supabase.from('recipes').update(updatePayload).eq('id', existing.id)`
  3. Po update, kontynuuj obecne zachowanie (linkowanie share'a)
- **Pułapka**: pole `existed: id`/`select 'id'` musi też pobrać aktualne wartości czasów żeby porównać null. Zmodyfikuj `select('id')` na `select('id, prep_time_minutes, cook_time_minutes, total_time_minutes')`.

#### 2. Refresh script

**Plik**: `scripts/refresh-recipe-times.ts` (nowy)

**Cel**: Skrypt CLI który dla każdego rekordu w `recipes` mającego `prep_time_minutes IS NULL OR cook_time_minutes IS NULL OR total_time_minutes IS NULL`, fires Inngest event `recipe/extract` z istniejącym shareId i URL. Inngest function (rozszerzona w #1) wypełni luki.

**Kontrakt**: 
- Import wzorca z `scripts/check-auth.ts` (env loading)
- Service-role Supabase client (lub anon-key + RLS dla autora)
- Query: `select r.id, r.source_url, r.user_id, r.source_type, rs.id as share_id from recipes r join recipe_shares rs on rs.recipe_id = r.id where r.prep_time_minutes is null or r.cook_time_minutes is null or r.total_time_minutes is null`
- Dla każdego: `await inngest.send({ name: 'recipe/extract', data: { shareId, sharedUrl: source_url, userId: user_id, sourceType: source_type } })`
- Log każdy wyzwolony event
- Run via `node --env-file=.env.local --import tsx scripts/refresh-recipe-times.ts`

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`
- ESLint przechodzi: `pnpm exec eslint src/inngest/functions.ts scripts/refresh-recipe-times.ts`

#### Weryfikacja ręczna

- Uruchom `pnpm exec tsx scripts/refresh-recipe-times.ts` po deployu Phase 1+2 — w konsoli logi „Triggered refresh for recipe N (URL ...)" dla każdego przepisu
- W Inngest dashboard widać runs dla recipe/extract
- Po ~1-3 min: `select id, title, prep_time_minutes, cook_time_minutes, total_time_minutes from recipes` pokazuje wypełnione wartości dla istniejącego przepisu (Tortilla z patelni)
- Detail page Tortilli pokazuje czasy

**Uwaga implementacyjna**: Po zakończeniu fazy zatrzymaj się na manual confirmation.

---

## Strategia testowania

### Testy jednostkowe

- `format-minutes.ts`: 0 min, < 60, == 60, > 60 dzielne, > 60 z resztą, duże liczby. (Pomiń jeśli brak vitest setup — tak jak w recipe-url-dedup Phase 1.)

### Testy integracyjne

- Brak nowych — istniejące Playwright e2e dla add-recipe form powinny dalej działać niezmienione.

### Kroki testowania ręcznego

1. Po Phase 1: udostępnij nowy URL przepisu, sprawdź że czasy zostały zapisane w bazie
2. Po Phase 2: otwórz detail page nowego przepisu — widoczne badge'y z czasami
3. Po Phase 3: uruchom skrypt, sprawdź że Tortilla z patelni ma czasy w bazie i na detail page

## Uwagi dotyczące wydajności

Brak istotnych. Dodanie 3 kolumn int nullable to brak praktycznego wpływu. OpenAI prompt rośnie o ~5 linii — pomijalne. Render dodaje 3 conditional spany.

## Uwagi dotyczące migracji

- Migration idempotentna (`alter table ... add column if not exists` — albo standardowy `add column`, schema check sam ostrzeże).
- Rollback: `alter table public.recipes drop column prep_time_minutes` (itd.). Stracimy dane czasów.

## Referencje

- Schema: `supabase/migrations/20260607000000_recipe_schema.sql`
- Inngest function po Phase 3 recipe-url-dedup: `src/inngest/functions.ts`
- Detail page: `src/app/(authenticated)/recipes/[slug]/page.tsx`
- Lesson o env validation: `context/foundation/lessons.md:64-72`
- Roadmap S-04 (overlap deferral): `context/foundation/roadmap.md:147-157`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` przy realizacji.

### Faza 1: Schema + extraction

#### Automatyczne

- [x] 1.1 TypeScript przechodzi: `pnpm exec tsc --noEmit` — f98f606
- [x] 1.2 Migration aplikuje się: `pnpm exec supabase db push` — f98f606
- [x] 1.3 ESLint przechodzi na zmienionych plikach — f98f606

#### Ręczne

- [x] 1.4 Schema query potwierdza 3 nowe nullable int kolumny — f98f606
- [ ] 1.5 Nowy share przepisu z bloga zwraca wartości w nowych polach (gdy obecne w treści)

### Faza 2: Render

#### Automatyczne

- [x] 2.1 TypeScript przechodzi: `pnpm exec tsc --noEmit`
- [x] 2.2 ESLint przechodzi na zmienionych plikach

#### Ręczne

- [ ] 2.3 Detail page przepisu z czasami pokazuje badge'y z poprawnym formatem PL
- [ ] 2.4 Detail page bez czasów (wszystkie null) nie pokazuje sekcji
- [ ] 2.5 Częściowe dane (1 z 3 null) renderuje tylko niepuste badge'y

### Faza 3: Bulk refresh existing recipes

#### Automatyczne

- [ ] 3.1 TypeScript przechodzi: `pnpm exec tsc --noEmit`
- [ ] 3.2 ESLint przechodzi na zmienionych plikach

#### Ręczne

- [ ] 3.3 Skrypt loguje wyzwolone eventy
- [ ] 3.4 Po Inngest run, Tortilla z patelni ma wypełnione czasy
- [ ] 3.5 Detail page Tortilli pokazuje sekcję czasów
