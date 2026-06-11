# Image archive storage — krótki plan

> Pełny plan: `context/changes/image-archive-storage/plan.md`

## Co i dlaczego

Obrazki przepisów żyją dziś na cudzych CDN-ach (mecooks.pl, FB, blogi) — usunięcie posta albo zmiana ścieżki obrazu psuje detail page. Plan zapisuje kopię obrazka w Supabase Storage podczas ekstrakcji, więc nawet gdy oryginał zniknie, mama nadal widzi swój przepis z miniaturką. To rdzeń filozofii archive-first z PRD.

## Punkt wyjścia

`recipes.image_url` trzyma external URL z Firecrawl `metadata.ogImage`. Detail page używa `next/image` z wildcard `remotePatterns: 'https://**'` (PR #59 jako temporary unlock). Storage włączony w Supabase config ale **brak bucket'u** — nie istnieje miejsce dla archiwum.

## Pożądany stan końcowy

Każdy nowy share od deployu archiwizuje og:image jako `recipe-images/<user_id>/<recipe_id>.<ext>` w public bucket; `recipes.image_url` ma teraz pełny Supabase Storage public URL. Detail page renderuje bez zmian (next/image dostaje URL jak dotychczas). Usuwanie przepisu czyści plik. Skrypt jednorazowo archiwizuje istniejącą Tortillę z patelni. Best-effort: gdy download fails (404, > 5MB, zły MIME) zostaje external URL.

## Kluczowe podjęte decyzje

| Decyzja                              | Wybór                                                                     | Dlaczego                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Bucket visibility                    | Public                                                                    | Oryginalne og:image są publiczne; private bucket dodaje signed-URL TTL bez korzyści   |
| Failure fallback                     | Keep external URL                                                         | Detail page nigdy ma broken image; archive jest best-effort zgodnie z PRD             |
| MIME whitelist + size limit          | jpeg/png/webp, max 5 MB                                                   | Pokrywa 95% blog og:image; bezpieczne dla Workers timeout + Storage cost              |
| Path scheme                          | `<user_id>/<recipe_id>.<ext>`                                             | RLS naturalnie per-user; quota tracking; brak konfliktów                              |
| URL storage strategy                 | Full public URL w `image_url`                                             | Zero zmian w detail page; CDN cache stabilny; URL przewidywalny                       |
| Delete cleanup                       | `storage.remove` w API delete route                                       | Brak orphans w Storage; race do orphana akceptowalna (orphan to nie blocker)          |
| Backfill istniejących                | `scripts/archive-recipe-images.ts` + Inngest gap-fill rozszerzony         | Mirror wzorca z `refresh-recipe-times.ts`; idempotentne                               |

## Zakres

**W zakresie:**
- Migration: bucket `recipe-images` (public, 5MB, MIME whitelist) + RLS
- `src/lib/recipe-image-archive.ts` helper (download → validate → upload → public URL)
- Inngest function: archiwizacja w insert + gap-fill flow
- API delete: cleanup Storage
- Skrypt + Inngest gap-fill rozszerzenie dla backfill

**Poza zakresem:**
- Image resizing / WebP conversion (next/image robi runtime)
- Lifecycle / TTL na Storage
- Multi-image / gallery
- Schema change: `image_url` → `image_storage_path` (full URL stored)
- SVG / video support

## Architektura / Podejście

Helper `archiveImage()` jest pure: `fetch(externalUrl)` z timeout → walidacja `Content-Type` i `Content-Length` → `storage.upload(<userId>/<recipeId>.<ext>, bytes)` → return `getPublicUrl()`. Inngest function woła helper w 2 miejscach (insert + gap-fill) i interpretuje result (storage URL lub fallback do external). Delete route parse'uje storage path z `image_url` i wywołuje `storage.remove`. Backfill = mirror `refresh-recipe-times.ts` script + rozszerzenie gap-fill semantics żeby nadpisać external URL gdy archiwizacja się powiedzie.

## Fazy w skrócie

| Faza                              | Co dostarcza                                                              | Kluczowe ryzyko                                                            |
| --------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1. Foundation + cleanup           | Bucket + helper + Inngest archive (insert+gap-fill) + delete cleanup       | Workers fetch timeout/size handling; MIME sniffing bez wczytania całego body |
| 2. Backfill                       | Skrypt CLI + rozszerzenie gap-fill semantics (overwrite external URL)     | Gap-fill semantyka „archive wins over external" musi być pojedynczo testowalna |

**Wymagania wstępne:** Brak. Master ma działający Inngest pipeline.
**Szacowany nakład pracy:** ~1 sesja na fazę, 2 PR-y.

## Otwarte ryzyka i założenia

- Workers `fetch` na external image może mieć rate-limity / CDN bot detection — założenie: og:image z typowych blogów (mecooks, kwestia smaku) działa.
- Cloudflare Workers payload limit 100MB nie powinien stanowić problemu przy 5MB cap. Inngest function `extract-recipe` timeout 45s daje budżet na download.
- MIME validation oparta na `Content-Type` header — niektóre serwery łżą. Akceptowalne dla MVP.

## Kryteria sukcesu (podsumowanie)

- Nowy share przepisu → `image_url` to storage URL; plik w bucket; detail page renderuje
- Delete recipe → plik znika ze Storage
- Skrypt podciąga Tortilla z patelni; detail page nadal renderuje (z storage URL)
