# Image archive storage — plan implementacji

## Przegląd

Zarchiwizuj obrazki przepisów w Supabase Storage podczas ekstrakcji, żeby przeżyły usunięcie/CDN rotation oryginalnego źródła. Spełnia archive-first z PRD (Wizja: „trwała kopia... niezależna od oryginału"). Dziś `recipes.image_url` trzyma external URL (mecooks.pl/...); jutro może 404 albo zmienić path.

## Analiza stanu obecnego

- Schema `recipes.image_url text` (`supabase/migrations/20260607000000_recipe_schema.sql:39`) — string URL, brak rozdzielenia external vs archived.
- Inngest function (`src/inngest/functions.ts`) extractuje `ogImage` z Firecrawl metadata i zapisuje do `image_url` bezpośrednio.
- URL-collision branch (z recipe-detail-improvements Phase 3) ma gap-fill: jeśli existing recipe ma `image_url = null`, wypełnia. Ale jeśli `image_url` zawiera external URL, gap-fill nie ruszy — bo nie jest null.
- Detail page używa `next/image` z `src={typedRecipe.image_url}` + `remotePatterns: 'https://**'` (PR #59 jako temporary unlock).
- API delete (`src/app/api/recipes/delete/route.ts`) usuwa tylko z DB, brak storage cleanup.
- Supabase Storage włączony w `supabase/config.toml` ale **brak bucket'u**. Trzeba stworzyć.
- Decyzja: public bucket — oryginalne og:image są publiczne content, archiwizacja nie zmienia poziomu prywatności.

## Pożądany stan końcowy

Po wdrożeniu:
- Każdy nowy ekstraktowany przepis ma `image_url` w formie `https://<project>.supabase.co/storage/v1/object/public/recipe-images/<user_id>/<recipe_id>.<ext>` (jeśli download/upload się udał) lub external URL (fallback gdy nie).
- Detail page renderuje obrazki przez `next/image` bez zmian w komponencie.
- Usunięcie przepisu czyści również plik w Storage.
- Skrypt `scripts/archive-recipe-images.ts` wypełnia istniejący przepis (Tortilla z patelni) zarchiwizowanym URL przez Inngest gap-fill.

### Kluczowe odkrycia

- `image_url` jest pełnym URL, nie ścieżką. Strategia: zachowujemy całe `https://...supabase.co/...` w polu — zero zmian w detail page.
- Inngest function `src/inngest/functions.ts:117` na insert używa `ogImage ?? null` — punkt do wpięcia archiwizacji.
- URL-collision branch `src/inngest/functions.ts:147-180` (po Phase 3 recipe-detail-improvements) wypełnia tylko nulle. Backfill wymaga rozszerzenia: również nadpisuj external URL gdy archiwizacja się udała.
- Lesson [centralize env reads](file:///C:/Users/spoko/www/zapiszprzepis/context/foundation/lessons.md#L64-L72) — `recipe-image-archive.ts` jako shared helper, używany z dwóch miejsc Inngest function (insert + gap-fill).

## Czego NIE robimy

- Image resizing / WebP conversion (Next/Image robi to runtime — wystarczy).
- Lifecycle policies / TTL na Storage (nic nie wygasa).
- CDN headers tuning (Supabase Storage ma domyślny cache-control).
- Multi-image / gallery (osobny scope).
- Cron cleanup orphans (delete cleanup w Phase 1 wystarczy; orphans z race conditions akceptujemy).
- Migration column `image_url` → `image_storage_path` (full URL stored — zero schema change w `recipes` table).
- Wsparcie SVG / video (niepotrzebne dla og:image typowo).

## Podejście do implementacji

Dwie fazy:

1. **Foundation + cleanup**: stworzenie bucketu w migracji, helper `recipe-image-archive.ts`, wpięcie w Inngest insert + gap-fill flow, storage cleanup w API delete. **Nowe shares** zaczynają archiwizować.
2. **Backfill**: skrypt + rozszerzenie gap-fill semantics żeby nadpisał external URL gdy archiwizacja się powiedzie. **Istniejące przepisy** podciągnięte.

Archive helper jest pure: download bytes (z timeout) → sniff Content-Type → walidacja MIME/size → upload do Storage → zwróć public URL lub null (fallback). Inngest function woła helper i interpretuje wynik.

## Faza 1: Foundation + cleanup

### Przegląd

Storage bucket setup, archive helper, integracja w Inngest function (insert flow + URL-collision gap-fill flow), cleanup w API delete.

### Wymagane zmiany

#### 1. Migration: bucket + RLS policy

**Plik**: `supabase/migrations/<TIMESTAMP>_image_archive_storage.sql` (nowy — użyj `date -u +%Y%m%d%H%M%S`)

**Cel**: Stworzyć bucket `recipe-images` (public, MIME whitelist jpeg/png/webp, 5MB limit) i RLS policy dla service role + public read.

**Kontrakt**:
- `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('recipe-images', 'recipe-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])`
- Policy `recipe_images_public_read` na `storage.objects` dla SELECT na `bucket_id = 'recipe-images'` (all users, since bucket is public).
- Policy `recipe_images_service_write` na `storage.objects` dla INSERT/UPDATE/DELETE — service role only (Inngest function używa service role).
- Idempotentność: `on conflict (id) do nothing` na bucket insert.

#### 2. Archive helper

**Plik**: `src/lib/recipe-image-archive.ts` (nowy)

**Cel**: Pure function `archiveImage(supabase, userId, recipeId, externalUrl)` → `Promise<string | null>`. Download bytes z `externalUrl` (timeout 15s), check Content-Type i size, upload do `recipe-images/<userId>/<recipeId>.<ext>`, zwróć public URL. Zwróć `null` jeśli cokolwiek się nie powiodło (caller fallback).

**Kontrakt**:
- Signature: `archiveImage(supabase: SupabaseServiceClient, userId: string, recipeId: number, externalUrl: string): Promise<string | null>`
- Allowed MIME: `image/jpeg`, `image/png`, `image/webp` (set jako const)
- Max bytes: `5 * 1024 * 1024`
- Extension mapping: jpeg → `.jpg`, png → `.png`, webp → `.webp` (dla URL aesthetics)
- Upload path: `${userId}/${recipeId}.${ext}` z opcją `upsert: true` (idempotentne re-runs)
- Public URL z `supabase.storage.from('recipe-images').getPublicUrl(path)`.
- Wszystkie błędy łapie i loguje `console.warn`, zwraca `null` — fallback do external URL po stronie callera.
- **Pułapka**: `fetch` w Workers wymaga `AbortSignal.timeout()` żeby nie wisiał; download size check na podstawie `Content-Length` header BEFORE reading body (oszczędność).

#### 3. Wpięcie archive w Inngest insert flow

**Plik**: `src/inngest/functions.ts`

**Cel**: W insert flow, po udanym INSERT do `recipes`, jeśli `ogImage` nie jest null, wywołaj `archiveImage(supabase, userId, recipe.id, ogImage)`. Jeśli zwróci storage URL, UPDATE `recipes.image_url` z tym URL. Jeśli null, zostaw external URL z insertu (już zapisany).

**Kontrakt**: Importuj `archiveImage` z `@/lib/recipe-image-archive`. Po `if (data) { recipe = data; break }`, dodaj archive step. Wymaga recipe.id z insertu — `select('id')` już istnieje. UPDATE: `await supabase.from('recipes').update({ image_url: archivedUrl }).eq('id', recipe.id)`.

#### 4. Wpięcie archive w URL-collision gap-fill flow

**Plik**: `src/inngest/functions.ts`

**Cel**: W gap-fill flow (`error?.message.includes(URL_KEY)`), gdy `existing.image_url` jest null AND `ogImage` jest dostępny, **archiwizuj** zamiast użyć surowego `ogImage`. Wypełnij `image_url` zarchiwizowanym URL.

**Kontrakt**: Modyfikuj sekcję `if (existing.image_url == null && ogImage != null) { gapFill.image_url = ogImage }` na:
```ts
if (existing.image_url == null && ogImage != null) {
  const archived = await archiveImage(supabase, userId, existing.id, ogImage)
  gapFill.image_url = archived ?? ogImage
}
```

#### 5. Cleanup w API delete

**Plik**: `src/app/api/recipes/delete/route.ts`

**Cel**: Przed DELETE z `recipes`, jeśli `image_url` zaczyna się od `<project>.supabase.co/storage/` (znaczy: zarchiwizowany), wyciągnij path i wywołaj `storage.from('recipe-images').remove([path])`. Logging na fail, ale nie blokuj delete.

**Kontrakt**: Po `select id, image_url` przed delete, helper `extractStoragePath(image_url): string | null` — regex/URL parsing do wyciągnięcia path. Jeśli zwróci path, `await supabase.storage.from('recipe-images').remove([path])`. Errors → `console.warn`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`
- Migration aplikuje się: `pnpm exec supabase db push`
- ESLint przechodzi na zmienionych plikach
- W Supabase dashboard widać bucket `recipe-images` (public, 5MB limit)

#### Weryfikacja ręczna

- Udostępnij nowy URL przepisu z bloga zawierającego og:image (np. inny mecooks tortilla post)
- Po Inngest run, w `recipes` row `image_url` zaczyna się od `https://wvrlgddgdddwmgzbvtij.supabase.co/storage/v1/object/public/recipe-images/<user_id>/`
- Plik widoczny w Supabase Storage dashboard pod właściwą ścieżką
- Detail page nowego przepisu renderuje obrazek (próba kliknięcia w „Otwórz oryginał" → external URL nadal działa)
- Usuń przepis przez UI → plik znika ze Storage
- Test fallback: udostępnij URL bloga którego og:image jest 404 albo > 5MB → `image_url` pozostaje external (lub null jeśli og:image nie istnieje), detail page nadal renderuje

**Uwaga implementacyjna**: Po zakończeniu fazy i pomyślnym przejściu weryfikacji, zatrzymaj się na ręczne potwierdzenie.

---

## Faza 2: Backfill istniejących przepisów

### Przegląd

Skrypt CLI mirror wzorca `refresh-recipe-times.ts`, plus rozszerzenie gap-fill semantics żeby zastąpił external URL zarchiwizowanym (overwrite, nie gap-fill, gdy nowy URL jest storage URL).

### Wymagane zmiany

#### 1. Rozszerzenie gap-fill semantics dla image_url

**Plik**: `src/inngest/functions.ts`

**Cel**: Bieżący gap-fill wypełnia `image_url` tylko gdy null. Dla backfill istniejących external URLs, gdy archiwizacja się powiedzie, ZAWSZE nadpisz — niezależnie od tego co jest. Logika: jeśli `archiveImage()` zwróci storage URL (NOT null), nadpisz `image_url`.

**Kontrakt**: W gap-fill branch zmień:
```ts
if (ogImage != null) {
  const archived = await archiveImage(...)
  if (archived != null) {
    gapFill.image_url = archived  // overwrite, even if existing has external URL
  } else if (existing.image_url == null) {
    gapFill.image_url = ogImage   // fallback to external, only if had nothing
  }
}
```
Zachowuje semantykę „archive wins over external; external wins over null".

#### 2. Refresh script

**Plik**: `scripts/archive-recipe-images.ts` (nowy)

**Cel**: Mirror `scripts/refresh-recipe-times.ts`. Znajdź przepisy gdzie `image_url` nie jest zarchiwizowany (nie zaczyna się od `<project>.supabase.co/storage`), fire Inngest event dla każdego. Inngest gap-fill (po #1) zarchiwizuje.

**Kontrakt**:
- Import wzorca z `scripts/refresh-recipe-times.ts` (env loading, supabase service client, inngest client)
- Query: `select r.id, r.source_url, r.user_id, r.source_type, r.image_url, rs.id as share_id ... where r.image_url not ilike 'https://wvrlgddgdddwmgzbvtij.supabase.co/storage/%' or r.image_url is null`
- Skip jeśli `image_url is null` — nie ma co archiwizować (chyba że re-extract znajdzie ogImage)
- Dla każdego: `inngest.send({ name: 'recipe/extract', data: { shareId, sharedUrl, userId, sourceType } })`
- Log każdy event
- Run via `pnpm exec node --env-file=.env.local --import tsx scripts/archive-recipe-images.ts`

#### 3. Package.json script

**Plik**: `package.json`

**Cel**: Dodaj `"archive:recipe-images"` script analogicznie do `refresh:recipe-times`.

**Kontrakt**: `"archive:recipe-images": "node --env-file=.env.local --import tsx scripts/archive-recipe-images.ts"`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript przechodzi: `pnpm exec tsc --noEmit`
- ESLint przechodzi na zmienionych plikach

#### Weryfikacja ręczna

- Uruchom `pnpm archive:recipe-images` po deployu Phase 1 — logi „Triggered archive for recipe N (URL ...)" dla Tortilli
- Inngest dashboard pokazuje run dla `recipe/extract`
- Po ~30-60s: `select id, image_url from recipes where id = <tortilla id>` pokazuje URL zaczynający się od `https://wvrlgddgdddwmgzbvtij.supabase.co/storage/`
- Plik widoczny w Supabase Storage dashboard
- Detail page Tortilli nadal renderuje (z nowego URL)

**Uwaga implementacyjna**: Po zakończeniu fazy i pomyślnym przejściu weryfikacji, zatrzymaj się na ręczne potwierdzenie.

---

## Strategia testowania

### Testy jednostkowe

- Brak — `archiveImage` to integration helper; testy E2E bardziej sensowne.

### Testy integracyjne

- Brak nowych — istniejące Playwright add-recipe powinny nadal działać.

### Kroki testowania ręcznego

1. Po Phase 1: share nowy URL → `recipes.image_url` to storage URL; obrazek widoczny w bucket; detail page renderuje
2. Po Phase 1: delete recipe → plik znika ze Storage
3. Po Phase 1: share URL bez og:image lub z og:image > 5MB → fallback do external URL działa
4. Po Phase 2: skrypt podciąga Tortillę; image_url ma storage URL

## Uwagi dotyczące wydajności

- Download (Firecrawl + obrazek) wydłuża Inngest run o ~1-3s na obrazek typowego rozmiaru (~500KB).
- Storage upload to ~500ms-1s typowo.
- Workers fetch ma limit ~100MB ciała — nasze 5MB limit jest bezpieczne.
- Inngest function timeout 45s już ustawiony — pozostaje budżet ~30s na archiwizację + DB ops.

## Uwagi dotyczące migracji

- Bucket creation idempotentne via `on conflict do nothing`
- Rollback: drop bucket (manual via dashboard) + drop migration. Stracone zarchiwizowane obrazki — w MVP akceptowalne.

## Referencje

- Schema: `supabase/migrations/20260607000000_recipe_schema.sql:39`
- Inngest function: `src/inngest/functions.ts`
- Delete API: `src/app/api/recipes/delete/route.ts`
- Wzorzec backfill: `scripts/refresh-recipe-times.ts`
- Lesson o env validation: `context/foundation/lessons.md:64-72`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>` przy realizacji.

### Faza 1: Foundation + cleanup

#### Automatyczne

- [x] 1.1 TypeScript przechodzi: `pnpm exec tsc --noEmit`
- [x] 1.2 Migration aplikuje się: `pnpm exec supabase db push`
- [x] 1.3 ESLint przechodzi na zmienionych plikach
- [x] 1.4 Bucket `recipe-images` widoczny w Supabase dashboard (public, 5MB limit, MIME jpeg/png/webp)

#### Ręczne

- [ ] 1.5 Nowy share przepisu → `image_url` zaczyna się od storage URL; plik w bucket
- [ ] 1.6 Detail page nowego przepisu renderuje obrazek
- [ ] 1.7 Delete recipe → plik znika ze Storage
- [ ] 1.8 Fallback: og:image > 5MB lub 404 → `image_url` pozostaje external (lub null), detail nadal działa

### Faza 2: Backfill istniejących przepisów

#### Automatyczne

- [ ] 2.1 TypeScript przechodzi: `pnpm exec tsc --noEmit`
- [ ] 2.2 ESLint przechodzi na zmienionych plikach

#### Ręczne

- [ ] 2.3 `pnpm archive:recipe-images` loguje wyzwolone eventy
- [ ] 2.4 Po Inngest run Tortilla z patelni ma storage URL w `image_url`
- [ ] 2.5 Detail page Tortilli renderuje zarchiwizowany obrazek
