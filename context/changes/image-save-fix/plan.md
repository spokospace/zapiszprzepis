# Image Save Fix — Implementation Plan

## Overview

Add a fallback to the Firecrawl scrape path: when `scraped.metadata?.ogImage` is null (common on WordPress blogs without an SEO plugin), extract the first recipe-relevant `<img>` from the scraped HTML and use it as the image source. The rest of the pipeline — `archiveImage` → Supabase Storage → `image_url` — is unchanged.

## Current State Analysis

- Firecrawl returns `metadata.ogImage = null` for pages without `<meta property="og:image">` (confirmed live on `polskiekulinaria.pl`).
- `src/inngest/functions.ts:116` sets `ogImage = scraped.metadata?.ogImage` with no fallback; when null, `archiveImage` is never called and `image_url` stays null.
- The Blogspot path already has an identical fallback in `src/lib/blogger-feed.ts:56-58`: first `<img src>` from raw post HTML.
- Firecrawl is configured with `onlyMainContent: true` + `BLOG_EXCLUDE_TAGS` (`nav`, `header`, `aside`, `.related-posts`, etc.) so the returned HTML is clean article content — the first `<img>` is virtually always the recipe's featured photo.

## Desired End State

Recipes from WordPress blogs without `og:image` (e.g. `polskiekulinaria.pl`) get their first article image archived to Supabase Storage and stored in `image_url`, exactly as blogs with `og:image` do today.

### Key Findings

- `src/lib/recipe-image-archive.ts` is the canonical home for image helpers (`archiveImage`, `extractStoragePath`) — `extractFirstImage` belongs there.
- Many WP lazy-load plugins (Jetpack, WP Rocket, Smush) write the real URL to `data-lazy-src` or `data-src` and use a 1px placeholder in `src` — the regex must check lazy attrs first.
- `onlyMainContent: true` in Firecrawl already removes nav/header/sidebar noise, so no need for complex image-size heuristics.

## What We Are NOT Doing

- No change to the Blogspot path (`blogger-feed.ts` already has first-image fallback)
- No change to `archiveImage`, `extractStoragePath`, or the Storage bucket
- No DB schema changes
- No image resizing or additional MIME validation (existing 5 MB + MIME check in `archiveImage` applies)
- No filtering beyond URL-pattern skip — no `width`/`height` attribute parsing

## Implementation Approach

1. Add `extractFirstImage(html)` to `src/lib/recipe-image-archive.ts` — iterates `<img>` tags, prefers `data-lazy-src > data-src > src`, skips gravatar/avatar/logo URLs.
2. Import it in `src/inngest/functions.ts` and wire as a null-coalescing fallback on the `ogImage` assignment (line 116). Import and first usage go in the same Edit (no-unused-imports hook).

## Phase 1: Add helper and wire fallback

### Required Changes

#### 1. `src/lib/recipe-image-archive.ts` — add `extractFirstImage`

**Cel**: Export a new function that returns the URL of the first recipe-relevant image found in scraped HTML.

**Kontrakt**: `export function extractFirstImage(html: string): string | null`

- Iterates all `<img>` tags in document order.
- For each tag, resolves the URL in priority order: `data-lazy-src` → `data-src` → `src` (lazy attrs hold the real URL when `src` is a 1px placeholder).
- Skips any URL matching `/gravatar|avatar|\/logo/i`.
- Returns the first non-skipped URL, or `null` if none found.

```ts
export function extractFirstImage(html: string): string | null {
  const imgRegex = /<img\b[^>]+>/gi
  const SKIP = /gravatar|avatar|\/logo/i
  let m: RegExpExecArray | null
  while ((m = imgRegex.exec(html)) !== null) {
    const tag = m[0]
    const url =
      /data-lazy-src=["']([^"']+)["']/i.exec(tag)?.[1] ??
      /data-src=["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bsrc=["']([^"']+)["']/i.exec(tag)?.[1]
    if (url && !SKIP.test(url)) return url
  }
  return null
}
```

#### 2. `src/inngest/functions.ts` — import + fallback on line 116

**Cel**: When Firecrawl returns no `og:image`, use `extractFirstImage(html)` as fallback so the image archiving pipeline can still run.

**Kontrakt**: In the same Edit — add `extractFirstImage` to the existing import from `@/lib/recipe-image-archive` (line 6) and replace the `ogImage` assignment at line 116:

```ts
// before (line 116):
ogImage = scraped.metadata?.ogImage

// after:
ogImage = scraped.metadata?.ogImage ?? extractFirstImage(html) ?? undefined
```

`extractFirstImage` returns `string | null`; the trailing `?? undefined` normalises to `string | undefined` matching the declared type of `ogImage`.

### Kryteria sukcesu

#### Weryfikacja automatyczna

- TypeScript typecheck passes: `npm run typecheck`
- No lint errors: `npm run lint`

#### Weryfikacja ręczna

- Add `https://polskiekulinaria.pl/tiramisu-przepis-na-klasyczny-wloski-deser/` as a new recipe → after Inngest completes, `recipes.image_url` is a `*.supabase.co/storage/v1/object/public/recipe-images/...` URL (not null, not an external URL).
- Recipe image displays correctly on recipe card and detail page.
- Adding a recipe from a site with `og:image` is unaffected (path unchanged — fallback never triggers when `og:image` is present).
- Blogspot recipe extraction is unaffected (Blogspot path bypasses Firecrawl entirely).

---

## Strategia testowania

### Testy manualne

1. Dodaj `https://polskiekulinaria.pl/tiramisu-przepis-na-klasyczny-wloski-deser/` jako nowy przepis.
2. Poczekaj na zakończenie Inngest (`recipe/extract`).
3. Sprawdź `recipes.image_url` w Supabase dashboard — powinien być CDN URL (`/storage/v1/object/public/recipe-images/…`).
4. Otwórz przepis w aplikacji — zdjęcie powinno się wyświetlić na karcie i stronie szczegółów.
5. Dodaj przepis z bloga z `og:image` (np. mecooks.pl) i zweryfikuj, że zachowanie jest identyczne jak przed zmianą.

### Regesja

- Blogspot URL (np. z `.blogspot.com`) — ekstrakcja i obraz bez zmian.
- URL bez żadnych `<img>` w treści — `image_url = null`, brak błędu.

## Referencje

- Research: `context/changes/image-save-fix/research.md`
- Wzorzec reużyty z: `src/lib/blogger-feed.ts:56-58`
- Helper file: `src/lib/recipe-image-archive.ts`
- Firecrawl options: `src/lib/firecrawl.ts:30-62`

## Postęp

> Konwencja: `- [ ]` oczekujące, `- [x]` wykonane. Dodaj ` — <commit sha>`, gdy krok zostanie zrealizowany.

### Faza 1: Add helper and wire fallback

#### Automatyczne

- [x] 1.1 TypeScript typecheck passes: `npm run typecheck`
- [x] 1.2 No lint errors: `npm run lint`

#### Ręczne

- [x] 1.3 polskiekulinaria.pl recipe → `image_url` is Supabase Storage CDN URL after extraction — 0dc5738
- [x] 1.4 Recipe with `og:image` — behavior unchanged — 0dc5738
- [x] 1.5 Blogspot recipe — behavior unchanged — 0dc5738
