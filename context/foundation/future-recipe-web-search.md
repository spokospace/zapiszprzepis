# Future feature — recipe web search (discovery)

**Status:** out of MVP scope. A directional note, not an implementation plan.
**Date:** 2026-07-04

## Goal

The user types a keyword (e.g. "tortilla") and gets **a list of recipes from the web** — a simple
list with previews (title, image, source). Each preview has a **Save** button.

This is **discovering new** recipes, not searching the personal collection.
Searching saved recipes already exists (`RecipeSearch`, `?q=`, against the user's own database).

## Key decision: "Save" = the existing pipeline

The **Save** button on a preview **does nothing new** — it calls the existing
`addRecipeFromUrl(url)`:

```
Save (URL from result)
  → addRecipeFromUrl        (dedup: findExistingRecipeForUrl)
  → recipe_shares (Supabase)
  → event recipe/extract    (Inngest)
  → extraction: ingredients edited separately, text, steps, image
```

So ingredients / text / steps editing happens exactly as in the current save-from-URL flow.
The new feature only adds a **URL source** upstream of this pipeline.

## Near path (recommended) — Exa REST API

- Results source: **Exa REST API** (`POST https://api.exa.ai/search`, header `x-api-key`).
  NOT Exa MCP — MCP is a Claude Code developer tool, it doesn't work inside the app.
- Called from a **server action** (`EXA_API_KEY` server-side, never in the client).
  Same pattern as existing Firecrawl/OpenAI calls in `inngest/functions.ts`.
- Cloudflare Workers: plain `fetch`, no Node API — works without changes.
- Exa free tier: 1000 req/month → enough for 1 user.

### Three pitfalls
1. **Don't debounce** web search (like `RecipeSearch` every 300 ms) —
   every keystroke = 1 request = burned quota. Search on **submit/Enter**.
2. **Dedup results** — use `findExistingRecipeForUrl` to mark those already in the database.
3. **`type: 'auto'`, without `contents`** — content is extracted anyway by the pipeline after saving.
4. **Quality filtering** — Exa has no "recipe" category; narrow with `includeDomains`
   to sites the extractor already parses (blogs, YouTube), otherwise shops/forums will slip in.

## Far path (optional) — custom crawler engine

If this were to become a real search engine over a corpus (equivalent to
`plan_wyszukiwarki_przepisy.md` from Downloads): achieve **the goal** of that plan
but **discard its stack**. That plan assumes Python/FastAPI/Redis/Dramatiq/Meilisearch/
Docker Compose — foreign to this project and not hostable on Cloudflare Workers.

Mapping to the current stack (Inngest + Supabase + Next.js/Cloudflare):

| Plan from Downloads | Here |
| --- | --- |
| Redis + Dramatiq | **Inngest** (fanout + `{ cron }` functions) |
| httpx + selectolax | `fetch` + JSON-LD parser in TS |
| PostgreSQL | **Supabase Postgres** |
| Meilisearch | **Postgres FTS / pg_trgm**; Meilisearch only when the corpus demands it |
| FastAPI `/search` | Next.js route handler |

- Corpus = **separate table** (e.g. `recipe_index`, url-keyed, no `user_id`).
  Existing `recipes` (per-user, RLS) stays as the private collection.
- Long crawls must run in Inngest steps, not in a Workers request handler.
- **Legal risk** (conscious decision required): storing and serving full content of others'
  recipes (description/steps/images) is not the same as enumerating URLs from a sitemap.
  The Exa approach (import only selected items, one at a time) is safer here.

## Recommendation

Start with the Exa path when the feature enters scope. The crawler engine only if
zapiszprzepis is to become a real search product, and then on its own stack.
