---
project: "ZapiszPrzepis — Discovery via Exa"
version: 2
status: draft
created: 2026-07-04
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: "2026-07-06"
  after_hours_only: true
---

## Current System Overview

ZapiszPrzepis is a personal recipe-collection PWA deployed on Cloudflare Workers (OpenNext), accessible at `zapiszprzepis.pl`. Stack: Next.js, Supabase (PostgreSQL + magic-link auth + Storage), Inngest (async job runner), Firecrawl/OpenAI (recipe extraction), pnpm.

User base: a single private user (the author's mother) on Android Chrome; per-user data isolation via Supabase RLS.

Core functionality today:
- **RecipeSearch** — filters the user's own recipe collection by title or ingredient (`?q=` URL param; client-side `.includes()` over fetched rows)
- **`addRecipeFromUrl(url)`** — server action that deduplicates by URL, inserts into `recipe_shares`, and triggers the Inngest extraction event
- **Inngest extraction pipeline** — fetches page content (Firecrawl / yt-dlp) → extracts recipe (OpenAI) → normalizes ingredients → saves to the `recipes` table
- **Auth** — fully wired magic-link; long-lived session; SSR middleware
- **Web Share Target** — registered PWA target; the user shares a URL from any app and `addRecipeFromUrl` is invoked

## Problem Statement & Motivation

The app has no path for discovering new recipes. The user can only browse her own saved collection — to find a recipe she must leave the app, search externally, and share the URL back via Web Share Target.

The specific gap: the user's daily workflow is to look up a dish by name elsewhere (Facebook, search engine), then share the link back. The "elsewhere" step is friction — she sometimes forgets, sometimes loses the link.

Trigger: A dedicated recipe-search API, accessible from the existing serverless runtime via standard HTTP fetch, is now available. The existing `addRecipeFromUrl` pipeline already handles saving from any URL — the only missing piece is an in-app discovery UI and the API call.

## User & Persona

Unchanged — the author's mother (Android, Chrome). She gains an optional discovery path: instead of sharing from Facebook or YouTube, she can search directly in the app by typing or speaking the name of a dish. All existing paths (Web Share Target, direct URL sharing) remain available.

## Success Criteria

### Primary
- The user types a query in the app and within 2 seconds sees a list of internet recipe results; clicking "Zapisz" at a result triggers the existing pipeline and the recipe appears in the collection exactly as it does when sharing from a browser.

### Secondary
- Voice search works on Chrome for Android — the user speaks a dish name, the text field fills, and results appear after speech recognition completes.

### Guardrails
- Existing **RecipeSearch** (filtering the user's own collection) works without any change.
- **`addRecipeFromUrl` and the Inngest pipeline** behave identically to the Web Share Target flow — no regression.
- The external search API credentials never reach the client; all search calls are made server-side.
- The monthly search request quota (1,000 requests on the free tier) is not exceeded — search triggers only on explicit submit, never on keystroke input.

## User Stories

### US-01: User discovers recipes from the home screen

- **Given** a logged-in user on the home screen
- **When** they type a dish name into the discovery search field and press Enter (or tap the submit button)
- **Then** they see a list of internet recipe results — each card showing a title, thumbnail, source domain, and snippet — within 2 seconds

#### Acceptance Criteria
- Results appear within 2 seconds of submit
- Cards whose URLs are already in the user's collection display a "Już zapisano" indicator
- Search does not trigger while typing — only on explicit submit (Enter or button tap)
- Before: user had to leave the app and use Web Share Target; now the search happens inside the app

### US-02: User searches by voice

- **Given** a logged-in user on the home screen using a browser that supports voice input
- **When** they tap the microphone icon and speak a dish name in Polish
- **Then** the spoken text fills the search field and the search executes automatically after recognition completes

#### Acceptance Criteria
- The microphone button is present and functional on Chrome for Android
- Spoken Polish is correctly transcribed into the search field
- If voice input is not supported (non-supporting browser or non-secure context), the microphone button is hidden — no error is shown

### US-03: User previews a discovery result before saving

- **Given** a user viewing a list of discovery results
- **When** they tap a result card
- **Then** they see a preview page showing the title, thumbnail, source domain, and snippet from the search result, with a "Zapisz" button and a back arrow; the full recipe extraction pipeline does NOT run at this point

#### Acceptance Criteria
- Preview page is visually distinct from saved-recipe pages (light beige background)
- No extraction pipeline is triggered by viewing the preview
- Back arrow returns the user to the results list

### US-04: User saves a recipe from the preview

- **Given** a user viewing a recipe preview page
- **When** they tap "Zapisz"
- **Then** the button changes to a disabled "Zapisuję… pojawi się w Moich Przepisach za chwilę" state; the existing extraction pipeline starts; the user can continue reading the preview or navigate back

#### Acceptance Criteria
- Button becomes disabled immediately on tap — no double-submit
- The recipe appears in the user's collection via the same pipeline as Web Share Target, with no difference in output

## Scope of Change

- [new] Discovery search bar on the home screen (text input + submit button)
- [new] Voice input button adjacent to the search field
- [new] Server-side action that calls an external recipe search API and returns a result list with title, thumbnail, source domain, and snippet per result
- [new] Deduplication check that marks results already present in the user's collection with "Już zapisano"
- [new] Recipe preview page showing external result data (title, thumbnail, source, snippet) with a "Zapisz" button and back navigation
- [modified] Home screen layout — logout moved to icon in top corner; "Moje przepisy" button enlarged and repositioned as the primary element; discovery search added below it
- [preserved] RecipeSearch — existing own-collection filter (`?q=` param) unchanged and on a fully independent path
- [preserved] `addRecipeFromUrl(url)` and the Inngest extraction pipeline — called from the preview page identically to the Web Share Target path; no signature or behavior change

## Constraints & Compatibility

- **Backward compatibility** — no URL structure, API contracts, or data formats change for existing flows. RecipeSearch `?q=` param is unchanged. `addRecipeFromUrl` signature and behavior are unchanged. Web Share Target registration is unchanged.
- **Data migration** — none required; no schema changes, no backfill.
- **Existing integrations** — the Inngest pipeline, content-fetching, and recipe-extraction steps must continue working without modification.
- **Preserved behavior:**
  - RecipeSearch (own-collection filtering) runs on an entirely independent path from discovery search; changes to one must not affect the other.
  - `addRecipeFromUrl` is called from the new preview page with the same argument and produces the same result as the Web Share Target invocation.
  - Per-user data isolation (RLS) is unchanged — recipe records are created with the session user's identity, as before.
  - The external search API key is kept exclusively server-side; it must never appear in any client-delivered asset, log, or response.
  - Search triggers only on explicit user action (Enter or submit button) — never on keystroke — to stay within the monthly request quota.

## Business Logic Changes

No domain logic change. This is an infrastructure and UI change — a new URL source (external search results) feeds the existing extraction pipeline. The domain rule is unchanged:

> A recipe URL saved by the user passes through content fetching, recipe extraction, ingredient normalization, and archiving; the result is classified, structured, and stored in the user's collection.

The new discovery path supplies URLs; all domain decisions (category classification, language normalization, ingredient structuring) are handled by the existing pipeline without modification.

## Access Control Changes

No access control changes — current model preserved.

Discovery search is available only to authenticated users (same magic-link session). No new roles. No public access to search results. The external search API key is stored as a server-side secret and never exposed to the client — following the same pattern as the existing content-fetching and extraction API keys.

## Non-Goals

- **Pagination of search results** — the external API returns 10 results per query by default; pagination will be revisited if the limit proves insufficient in practice.
- **Category or diet filters in the search UI** — the external search API does not expose recipe-category filtering; no filter controls in the UI.
- **Caching of search results** — unnecessary for a single-user app at this scale.
- **Voice search on iOS / Safari** — voice input does not have full support on iOS Safari; no guarantee on iOS devices.
- **Sorting, rating, or pre-filtering of results before saving** — no thumbs-up/down, star rating, or manual re-ranking.
- **Full recipe extraction at preview time** — the extraction pipeline runs only after the user explicitly taps "Zapisz", consistent with the Web Share Target flow.

## Open Questions

1. **What happens when voice input is unavailable?** (Non-HTTPS context, or a browser that does not support the voice input API) — should the microphone button be hidden silently, or rendered in a disabled state with a tooltip? To be decided at implementation time.
