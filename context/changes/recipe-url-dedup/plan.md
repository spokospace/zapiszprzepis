# Recipe URL deduplication — plan implementacji

## Przegląd

Zapobiec re-ekstrakcji tego samego URL przepisu gdy user udostępnia go ponownie (Web Share Target lub formularz manualny). Oszczędza koszty Inngest/Firecrawl/OpenAI, eliminuje duplikaty w liście przepisów, i robi UX bardziej przewidywalny (redirect do istniejącego przepisu zamiast tworzenia kopii).

Ta zmiana obejmuje też powiązany bug fix: **slug collision** gdy dwie różne strony mają przepis o tym samym tytule (np. "Tortilla z patelni" na mecooks.pl i innym blogu) — obecnie crashuje INSERT na `unique(user_id, slug)`.

## Analiza stanu obecnego

- Schema `recipes`: `unique(user_id, slug)`, kolumna `source_url` nullable, brak ograniczenia unikalności na URL — `supabase/migrations/20260607000000_recipe_schema.sql:49`
- Schema `recipe_shares`: `shared_url not null`, status enum `pending/completed/failed`, brak normalizacji
- Dwa entry points uruchamiające ekstrakcję, oba bez dedup check:
  - `src/app/share/actions.ts` (Web Share Target POST)
  - `src/app/(authenticated)/recipes/add-recipe-action.ts` (manualny formularz)
- Slug generator: `src/lib/slugify.ts` — slugifikuje tytuł, brak retry przy collision
- Inngest function `src/inngest/functions.ts:102-118` — wykonuje `.insert(...).single()` bez obsługi unique violation
- RLS na `recipes` i `recipe_shares` egzekwuje per-user isolation; dedup musi być per-user

## Pożądany stan końcowy

Po wdrożeniu:
- User udostępnia URL którego ekstrakcja była **completed** → redirect na `/recipes/<slug>?duplicate=1`, toast „Ten przepis już masz".
- User udostępnia URL którego share jest **pending** → redirect na `/recipes?duplicate=pending`, toast „Już przetwarzam ten przepis — wróć za chwilę".
- User udostępnia URL którego ekstrakcja **failed** → normalna ścieżka (nowa próba ekstrakcji).
- Dwie strony z różnymi przepisami ale tym samym tytułem → unikalne slugi (`tortilla-z-patelni`, `tortilla-z-patelni-2`).
- DB egzekwuje `unique(user_id, source_url)` na `recipes` — race conditions zabezpieczone na poziomie schematu.

### Kluczowe odkrycia

- `recipes.source_url` jest nullable — unique constraint w PostgreSQL nie konfliktuje na NULL, więc istniejący 1 przepis (z source_url ustawionym) potrzebuje backfillu, ale starsze NULL wiersze (gdyby były) by działały.
- `current_user_id()` SECURITY DEFINER wrapper jest dostępny do użycia w policies — `supabase/migrations/20260529093516_init_auth_helpers.sql` (referencjonowany w RLS policies).
- Inngest function używa `getSuabaseServiceRoleKey()` — service role bypassuje RLS, więc dedup check w Server Action (cookie-aware) i slug retry w Inngest (service role) muszą obie filtrować po `user_id` jawnie.

## Czego NIE robimy

- Bulk re-extract istniejących failed shares (osobny feature, wymaga UI lub admin command)
- Cross-user dedup (nie ma sensu — RLS, prywatność)
- Migration istniejących duplikatów (jest 1 przepis, brak duplikatów do scalenia)
- Telemetria dedup hit rate (POC, nie potrzebne)
- Wsparcie dla URL shorteners (bit.ly, t.co — wymaga unfolding, osobny scope)
- Aggressive query param stripping (utm_*, fbclid) — minimal normalization wystarczy na MVP

## Podejście do implementacji

Trzy warstwy obrony przeciwko duplikatom, każda na innej warstwie:

1. **DB** (Phase 1): unique constraint `(user_id, source_url)` na `recipes` blokuje finalny INSERT przy race.
2. **Application** (Phase 2): pre-check w Server Action zatrzymuje request **zanim** dotrze do Inngest — oszczędza koszt API i daje natychmiastowy redirect.
3. **Slug retry** (Phase 3): w Inngest function, gdy slug ma collision z innym istniejącym przepisem (różnym URL ale tym samym tytułem), retry z licznikiem.

URL normalization jest minimalna: lowercase hostname, strip trailing slash, strip fragment. Reszta URL (path, query) zachowana — query params często niosą informację o konkretnym przepisie.

`source_url` w `recipes` i `shared_url` w `recipe_shares` przechowują znormalizowaną formę (`source_url` jest tym, którego używamy do dedup). Migration backfilluje istniejące wiersze.

## Faza 1: Schema + URL normalizer

### Przegląd

Migracja DB: znormalizuj istniejące URL-e, dodaj unique constraint. Dodaj pure-function `url-normalize.ts` używaną później w Phase 2 i 3.

### Wymagane zmiany

#### 1. URL normalizer utility

**Plik**: `src/lib/url-normalize.ts` (nowy)

**Cel**: Wystawić `normalizeUrl(raw: string): string` jako pure function — używana przez Server Actions (Phase 2), Inngest function (przy zapisie `source_url`) i przez migrację (przy backfill). Brak zewnętrznych zależności — czysta logika oparta o `new URL()`.

**Kontrakt**: `normalizeUrl('HTTPS://Mecooks.PL/lunch/tortilla/#tutaj') === 'https://mecooks.pl/lunch/tortilla'`. Transformacje: lowercase `URL.hostname` (zachowuje case w path/query), strip trailing `/` z `pathname` (chyba że pathname to sam `/`), zignoruj `hash`. Throw `TypeError` przy malformed URL — caller decyduje co zrobić.

#### 2. Unit testy normalizera

**Plik**: `src/lib/url-normalize.test.ts` (nowy — jeśli projekt ma test runner; jeśli nie, pomiń)

**Cel**: Pokryć transformacje + edge cases: case insensitivity hosta, trailing slash, fragment, query param preservation, malformed URL throw.

**Kontrakt**: Testy dla każdej reguły transformacji + minimum 3 negative cases.

#### 3. Migration: backfill + unique constraint

**Plik**: `supabase/migrations/<TIMESTAMP>_recipe_url_dedup.sql` (nowy — użyj `date -u +%Y%m%d%H%M%S`)

**Cel**: Znormalizować istniejące `recipes.source_url` i `recipe_shares.shared_url`, potem dodać unique constraint `(user_id, source_url)` na `recipes` (partial gdzie `source_url IS NOT NULL` — żeby przyszłe NULL-e nie kolidowały).

**Kontrakt**:
- Pure SQL bez wywoływania TS code — backfill wykonany inline przez SQL functions (`lower()`, `regexp_replace()` dla trailing slash, `split_part(..., '#', 1)` dla fragmentu).
- Constraint: `create unique index recipes_user_source_url_uniq on public.recipes(user_id, source_url) where source_url is not null;`
- Migration musi być idempotentna w sensie „bezpieczna do uruchomienia w środowisku gdzie 1 wiersz już istnieje" — backfill UPDATE z `WHERE source_url IS NOT NULL`.
- **Pułapka**: SQL normalizer i TS normalizer muszą produkować identyczny wynik — udokumentować to w komentarzu migracji, wskazując `src/lib/url-normalize.ts` jako źródło prawdy semantycznej.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit` (nowe pliki bez błędów)
- Unit testy normalizera przechodzą (jeśli dodane)
- Migration aplikuje się czysto na lokalnej kopii: `supabase db reset` lub `supabase migration up`
- Brak nowych ESLint warnings: `pnpm lint` (jeśli skonfigurowany)

#### Weryfikacja ręczna

- Po migracji, istniejący wiersz „Tortilla z patelni" w `recipes` ma `source_url` w formie znormalizowanej (lowercase host, bez trailing slash, bez fragmentu)
- Sprawdź w Supabase SQL editor: `select source_url from recipes` powinno pokazać `https://www.mecooks.pl/lunch/tortilla-z-patelni` (bez końcowego `/`)
- Próba INSERT do `recipes` z duplikatem `(user_id, source_url)` rzuca unique violation

**Uwaga implementacyjna**: Po zakończeniu fazy i pomyślnym przejściu weryfikacji, zatrzymaj się na ręczne potwierdzenie.

---

## Faza 2: Dedup helper + Server Actions integration

### Przegląd

Helper `recipe-dedup.ts` enkapsuluje query do `recipes` (completed) i `recipe_shares` (pending). Oba Server Actions wywołują helper przed insertem nowego share/event do Inngest.

### Wymagane zmiany

#### 1. Dedup check helper

**Plik**: `src/lib/recipe-dedup.ts` (nowy)

**Cel**: Centralizować logikę „czy ten URL już istnieje dla tego usera?" jako pojedyncza funkcja używana przez oba Server Actions. Zgodne z duchem lesson o centralizacji w `src/lib/env.ts` — nowa odpowiedzialność = nowy moduł, nie inline w 2 plikach.

**Kontrakt**: 
```ts
type DedupResult = 
  | { status: 'new' }
  | { status: 'completed'; slug: string }
  | { status: 'pending' }

async function findExistingRecipeForUrl(
  supabase: SupabaseClient,
  userId: string,
  rawUrl: string,
): Promise<DedupResult>
```
- Normalizuje URL przez `normalizeUrl()`
- Query 1: `select slug from recipes where user_id = ? and source_url = ?` → jeśli znalezione, zwróć `completed`
- Query 2: jeśli nie completed, `select 1 from recipe_shares where user_id = ? and shared_url = ? and status = 'pending'` → jeśli znalezione, zwróć `pending`
- Inaczej zwróć `new`
- **Pułapka**: oba query muszą porównywać znormalizowane URL, więc `recipe_shares.shared_url` też musi być przechowywany znormalizowany przy nowych insertach (patrz #2 i #3). Migration z Phase 1 załatwił istniejące wiersze.

#### 2. Wpięcie w `add-recipe-action.ts`

**Plik**: `src/app/(authenticated)/recipes/add-recipe-action.ts`

**Cel**: Po walidacji URL i auth check, ale **przed** insertem do `recipe_shares` i `inngest.send`, wywołaj `findExistingRecipeForUrl`. Na `completed` → `redirect('/recipes/<slug>?duplicate=1')`. Na `pending` → `redirect('/recipes?duplicate=pending')`. Na `new` → kontynuuj obecny flow, ale używając `normalizeUrl(url)` przy zapisie do `recipe_shares.shared_url` i w payload Inngest.

**Kontrakt**: Dodatkowy import `findExistingRecipeForUrl` i `normalizeUrl`. Dwa nowe `redirect()` przed obecnym `insert`. Modyfikacja `insert` żeby używał znormalizowanego URL. Brak zmian w sygnaturze samego Server Action.

#### 3. Wpięcie w `share/actions.ts`

**Plik**: `src/app/share/actions.ts`

**Cel**: Te same trzy ścieżki co w `add-recipe-action.ts` — Web Share Target z systemu powinien zachowywać się identycznie jak manualny formularz przy duplikacie.

**Kontrakt**: Importuje `findExistingRecipeForUrl` i `normalizeUrl`. Funkcja `triggerRecipeExtraction` zwraca obecnie `{ shareId, message }` — przy duplikacie completed/pending zwraca `{ duplicate: 'completed', slug }` lub `{ duplicate: 'pending' }`. Caller (route handler `/share`) interpretuje to do odpowiedniego redirectu.

**Pułapka**: `/share/route.ts` (lub gdzie indziej w przepływie share) musi obsłużyć nowy wariant zwracany przez `triggerRecipeExtraction`. Wyłapać podczas implementacji.

#### 4. UX: toast/komunikat na podstawie query params

**Plik**: `src/app/(authenticated)/recipes/recipes-content.tsx` i ewentualnie `recipes/[slug]/page.tsx`

**Cel**: Pokazać tekstowy komunikat gdy URL ma `?duplicate=1` (na detail page) lub `?duplicate=pending` (na liście). Może być prostym banerem nad kontentem — nie wymaga toast library.

**Kontrakt**: Dodaj prop `duplicate?: 'completed' | 'pending'` do komponentu kontentu. Renderuj banner gdy ustawione. Tłumaczenia PL: „Ten przepis już masz" / „Już przetwarzam ten przepis — wróć za chwilę". Nie wymaga state — odczyt z searchParams w `page.tsx` (Promise — pamiętaj `await`).

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`
- ESLint przechodzi: `pnpm lint`
- Brak regression w testach Playwright dla add-recipe-form: `pnpm exec playwright test add-recipe`

#### Weryfikacja ręczna

- Udostępnij URL istniejącego przepisu (tortilla z patelni) → redirect na `/recipes/tortilla-z-patelni?duplicate=1`, widoczny komunikat „Ten przepis już masz"
- Udostępnij URL który ma pending share w bazie (manualnie ustawiony przez SQL dla testu) → redirect na `/recipes?duplicate=pending`, komunikat „Już przetwarzam…"
- Udostępnij nowy URL → normalny flow, ekstrakcja przebiega
- Udostępnij URL który był failed → normalny flow (nie blokuje), nowa próba

**Uwaga implementacyjna**: Po zakończeniu fazy i pomyślnym przejściu weryfikacji, zatrzymaj się na ręczne potwierdzenie.

---

## Faza 3: Slug collision retry w Inngest function

### Przegląd

Zabezpieczyć Inngest function `extract-recipe` przed crashem gdy `(user_id, slug)` koliduje z innym przepisem (różny URL, ten sam tytuł). Retry z licznikiem: `tortilla-z-patelni-2`, `tortilla-z-patelni-3`, itd.

### Wymagane zmiany

#### 1. Slug collision retry

**Plik**: `src/inngest/functions.ts`

**Cel**: Po pierwszej próbie `insert(...).select().single()` jeśli error jest unique violation na `(user_id, slug)`, retry z `baseSlug-2`, `-3`, ..., maksymalnie 10 prób. Po 10 nieudanych — throw (Inngest zarejestruje failure).

**Kontrakt**:
- Bazowy slug z `slugify(recipeJSON.title)`
- Loop: `for (let attempt = 1; attempt <= 10; attempt++)` — `attempt=1` używa bazowego slug, `attempt>1` używa `${baseSlug}-${attempt}`
- Po INSERT: jeśli `error.code === '23505'` (PostgreSQL unique_violation) i komunikat zawiera nazwę indeksu `recipes_user_id_slug_key` (lub podobnej — sprawdź faktyczną nazwę w schema), kontynuuj loop. Inaczej rzuć normalnie.
- Jeśli URL collision (`recipes_user_source_url_uniq`) — to znak że Phase 2 puścił coś przez sito (race przed insertem). W takim wypadku też retry? Nie — to znaczy że już istnieje przepis dla tego URL, więc po prostu zaktualizuj `recipe_shares` z istniejącym `recipe_id` zamiast tworzyć duplikat. Sprawdź `select id from recipes where user_id=? and source_url=?` żeby znaleźć istniejący wiersz i powiązać go z `share_id`.
- Maks 10 prób = przepisy 1-10 z tym samym tytułem; po tym throw — to wskazuje na coś nietypowego (spam? bug?), niech Inngest pokaże w dashboardzie.

**Pułapka**: nazwa constraintu w PostgreSQL przy `unique(user_id, slug)` to autogenerowane `recipes_user_id_slug_key` — potwierdź dokładną nazwę przed sprawdzeniem `error.message`. Alternatywnie: parsuj `error.details` które Supabase zwraca z konkretną informacją która kolumna kolidowała.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`

#### Weryfikacja ręczna

- Manualnie wstaw drugi przepis o tym samym tytule „Tortilla z patelni" przez Supabase SQL editor (różny `source_url`), żeby zasymulować collision
- Udostępnij URL trzeciego przepisu też zatytułowanego „Tortilla z patelni" z innego bloga
- W Inngest dashboard: run powinien zakończyć się sukcesem
- W tabeli `recipes` powinny być 3 przepisy: slugi `tortilla-z-patelni`, `tortilla-z-patelni-2`, `tortilla-z-patelni-3`
- Detail page każdego z 3 przepisów dostępny pod jego slugiem

**Uwaga implementacyjna**: Po zakończeniu fazy i pomyślnym przejściu weryfikacji, zatrzymaj się na ręczne potwierdzenie.

---

## Strategia testowania

### Testy jednostkowe

- `url-normalize.ts`: case insensitivity, trailing slash, fragment strip, query preservation, malformed throw
- `recipe-dedup.ts`: jeśli setup mockowy istnieje (Supabase client mock) — zwraca completed/pending/new dla różnych scenariuszy DB

### Testy integracyjne

- Brak nowych E2E testów wymaganych — istniejący Playwright `add-recipe.spec.ts` powinien dalej zielony

### Kroki testowania ręcznego

1. Udostępnij `https://www.mecooks.pl/lunch/tortilla-z-patelni/` ponownie (z trailing slash) — sprawdź redirect z toast
2. Udostępnij `HTTPS://WWW.MECOOKS.PL/lunch/tortilla-z-patelni#sekcja` — sprawdź że normalization wyłapuje to jako duplikat
3. Udostępnij URL który nie istnieje w bazie — normalny flow
4. Zasymuluj pending share przez SQL (`update recipe_shares set status='pending' where id=...`) — udostępnij ten sam URL, sprawdź blokadę
5. Po Phase 3: udostępnij dwa różne URL-e ze stron różnych autorów ale z tytułem „Tortilla z patelni" — drugi powinien dostać slug `tortilla-z-patelni-2`

## Uwagi dotyczące wydajności

Dedup check dodaje 1-2 query do Supabase przed insertem (~50-100ms łącznie na region EU). Akceptowalne dla MVP — Server Action już ma round-trip do auth.getUser() i insert do recipe_shares, dodatkowy SELECT jest pomijalny.

## Uwagi dotyczące migracji

- Idempotentność: backfill UPDATE używa `WHERE source_url IS NOT NULL` — bezpieczne do re-runu
- Rollback: jeśli migration trzeba cofnąć, drop unique index + ewentualnie revert source_url do oryginalnej formy (ale obecnie tracimy oryginalną wartość — to akceptowalne dla 1 przepisu testowego)

## Referencje

- Lesson „Centralize env reads in lib/env.ts": `context/foundation/lessons.md:64-72` — wzorzec dla `src/lib/recipe-dedup.ts`
- Schema: `supabase/migrations/20260607000000_recipe_schema.sql:49,67`
- Slug helper: `src/lib/slugify.ts`
- Entry points: `src/app/share/actions.ts`, `src/app/(authenticated)/recipes/add-recipe-action.ts`
- Inngest function: `src/inngest/functions.ts`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` przy realizacji.

### Faza 1: Schema + URL normalizer

#### Automatyczne

- [x] 1.1 TypeScript przechodzi: `pnpm exec tsc --noEmit` — 42e7401
- [ ] 1.2 Unit testy normalizera przechodzą (jeśli dodane)
- [x] 1.3 Migration aplikuje się czysto: `supabase db reset` lub `supabase migration up` — 42e7401
- [x] 1.4 Brak nowych ESLint warnings: `pnpm lint` — 42e7401

#### Ręczne

- [x] 1.5 Istniejący wiersz „Tortilla z patelni" ma znormalizowany `source_url` — 42e7401
- [x] 1.6 Duplikat INSERT do `recipes` z tym samym `(user_id, source_url)` rzuca unique violation — 42e7401

### Faza 2: Dedup helper + Server Actions integration

#### Automatyczne

- [x] 2.1 TypeScript przechodzi: `pnpm exec tsc --noEmit`
- [x] 2.2 ESLint przechodzi: `pnpm lint`
- [ ] 2.3 Playwright testy add-recipe przechodzą: `pnpm exec playwright test add-recipe`

#### Ręczne

- [ ] 2.4 Share istniejącego URL → redirect z toast „Ten przepis już masz"
- [ ] 2.5 Share URL z pending share → redirect z toast „Już przetwarzam…"
- [ ] 2.6 Share nowego URL → normalny flow ekstrakcji
- [ ] 2.7 Share URL po failed → normalny flow (nie blokuje)

### Faza 3: Slug collision retry w Inngest function

#### Automatyczne

- [ ] 3.1 TypeScript przechodzi: `pnpm exec tsc --noEmit`

#### Ręczne

- [ ] 3.2 3 przepisy o tym samym tytule mają slugi `<base>`, `<base>-2`, `<base>-3`
- [ ] 3.3 Każdy z 3 przepisów dostępny pod swoim slugiem na detail page
- [ ] 3.4 Inngest run dla 3-ciej próby zakończony sukcesem (nie failed)
