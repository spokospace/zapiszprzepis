# Image Save Fix — Krótki plan

> Pełny plan: `context/changes/image-save-fix/plan.md`
> Badania: `context/changes/image-save-fix/research.md`

## Co i dlaczego

WordPress blogi bez SEO pluginu nie ustawiają `<meta og:image>`, więc Firecrawl zwraca `metadata.ogImage = null`. Powoduje to, że `archiveImage` nigdy nie jest wywoływane i `image_url` zostaje null — mimo że strona ma wyraźne zdjęcie przepisu. Fix dodaje fallback: gdy brak `og:image`, wyciągamy pierwszą odpowiednią `<img>` z HTML.

## Punkt wyjścia

Strony Blogspot mają już identyczny fallback w `blogger-feed.ts:56-58`. Ścieżka Firecrawl (web_blog) tego fallbacku nie ma. `archiveImage` + Storage pipeline jest gotowy — trzeba tylko dostarczyć mu URL.

## Pożądany stan końcowy

Dodanie przepisu z `https://polskiekulinaria.pl/tiramisu-przepis-na-klasyczny-wloski-deser/` (i podobnych WP blogów bez og:image) skutkuje zapisaniem zdjęcia przepisu w Supabase Storage i wyświetlaniem go na karcie przepisu — tak samo jak dla blogów z og:image.

## Kluczowe podjęte decyzje

| Decyzja | Wybór | Dlaczego (1 zdanie) | Źródło |
|---|---|---|---|
| Atrybuty lazy-load | `data-lazy-src > data-src > src` | WP lazy-load plugins (Jetpack, WP Rocket) piszą real URL do data-lazy-src, src to 1px placeholder | Plan |
| Filtrowanie | Skip `/gravatar\|avatar\|\/logo/i` | Firecrawl z onlyMainContent już usuwa nav/sidebar; filtr URL to siatka bezpieczeństwa dla avatarów autorów | Plan |
| Lokalizacja helpera | `recipe-image-archive.ts` | Naturalny dom dla funkcji image-related obok `archiveImage` i `extractStoragePath` | Plan |
| Zakres zmiany | Tylko ścieżka Firecrawl (non-Blogspot) | Blogspot ma już fallback; YouTube ma thumbnail via youtube_id | Research |

## Zakres

**W zakresie:**
- Nowa funkcja `extractFirstImage(html)` w `src/lib/recipe-image-archive.ts`
- Fallback w `src/inngest/functions.ts` (linia 116)

**Poza zakresem:**
- Zmiany w ścieżce Blogspot
- Zmiany w `archiveImage`, `extractStoragePath`, Storage bucket
- Zmiany w schemacie DB
- Filtrowanie po rozmiarze obrazka (width/height atrybuty)

## Architektura / Podejście

`extractFirstImage(html)` iteruje `<img>` tagi, preferuje lazy-load atrybuty, pomija gravatary. W `functions.ts`: `ogImage = scraped.metadata?.ogImage ?? extractFirstImage(html) ?? undefined`. Reszta pipeline'u (archiveImage → Storage → image_url update) bez zmian.

## Fazy w skrócie

| Faza | Co dostarcza | Kluczowe ryzyko |
|---|---|---|
| 1. Add helper + wire fallback | Helper w recipe-image-archive.ts + fallback w functions.ts | Pierwszy `<img>` może być ikoną autorki jeśli blog nie używa BLOG_EXCLUDE_TAGS; filtr URL to mitygacja |

**Wymagania wstępne:** brak — to izolowana zmiana addytywna  
**Szacowany nakład:** 1 sesja, ~2 pliki, ~15 linii

## Otwarte ryzyka i założenia

- Zakładamy, że Firecrawl z `onlyMainContent: true` usuwa wystarczająco dużo szumu — jeśli jakiś blog ma inną strukturę, fallback może wyciągnąć zły obraz; można poprawić iteracyjnie.
- `data-lazy-src` i `data-src` to najczęstsze lazy-load atrybuty; inne (np. `data-original`) nie są obsługiwane.

## Kryteria sukcesu

- `polskiekulinaria.pl` tiramisu → `image_url` = Supabase Storage CDN URL po ekstrakcji
- Blogi z `og:image` i Blogspot — zachowanie identyczne jak przed zmianą
