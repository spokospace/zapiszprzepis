---
change_id: first-shared-recipe-fb-text
title: Pierwszy udostępniony przepis (FB tekstowy, end-to-end)
description: Gwiazda północna — mama udostępnia URL postu tekstowego z Facebooka i widzi polskojęzyczny przepis za 1-3 min
author: Szymon
status: proposed
dependencies:
  - F-01 (auth-and-supabase-scaffold)
  - F-02 (async-job-runner)
  - F-03 (pwa-shell-and-share-target)
---

# S-01: Pierwszy udostępniony przepis (FB tekstowy)

## Cel

Gwiazda północna — validate core hypothesis: mama udostępnia URL postu tekstowego z Facebooka przez systemowy gest „Udostępnij", widzi komunikat „Zapisałem" < 1s, a po 1-3 minutach widziana jest karta przepisu na liście z polskim tytułem i miniaturą. Po kliknięciu — pełny przepis ze zdjęciem, składnikami (UL), krokami (OL), źródłem.

## Wymagania wstępne (completed)

- F-01: Supabase auth, sesja, RLS
- F-02: Trigger.dev async job runner
- F-03: Web Share Target endpoint (POST /share)

## Fazy implementacji

### Faza 1: Recipe schema + RLS + DB migrations
- Create `recipes` table: `id`, `user_id`, `title`, `slug`, `description`, `image_url`, `ingredients` (JSON array), `steps` (JSON array), `source_type` (enum: facebook_text, web, youtube, etc), `source_url`, `category` (enum fixed taxonomy), `extracted_at`, `created_at`
- RLS policy: user can select/delete only own recipes
- Create `recipe_shares` table: `id`, `user_id`, `shared_url`, `recipe_id` (FK), `share_intent` (JSON: {url, title, text}), `status` (pending/completed/failed), `error_message`, `attempts`, `created_at`, `updated_at`
- RLS policy: user can select only own shares
- Create Supabase migration: `supabase/migrations/0002_recipe_schema.sql`
- Push migration: `pnpm exec supabase db push --linked`
- Update typegen: `pnpm exec supabase gen types typescript --linked > src/lib/supabase.types.ts`

### Faza 2: Recipe extraction task (Trigger.dev)
- Create `src/trigger/extract-recipe.ts` task:
  - Input: `shareId` (recipe_share ID), `sharedUrl`, `sharedTitle?`, `sharedText?`
  - Step 1: Fetch Facebook page with Firecrawl (URL + og:description + og:image)
  - Step 2: Parse HTML + og metadata → raw recipe text
  - Step 3: Call OpenAI gpt-4o-mini with prompt:
    - Extract: title (pl), ingredients (array), steps (array), category (fixed taxonomy 8)
    - Rules: translate EN→PL, convert US units→metric (approximate ok), infer category
    - Output: JSON {title, ingredients: [{name, amount, unit}], steps: [str], category, imageUrl}
  - Step 4: Insert recipe into DB + update recipe_shares status=completed
  - Error handling: catch & update recipe_shares with error message, set status=failed
  - Output: {recipeId, title, category, status}
- Create server action `triggerRecipeExtraction()` (src/app/share/actions.ts):
  - Called by POST /share after form submission
  - Create recipe_share record with status=pending
  - Trigger Trigger.dev task with shareId
  - Return {shareId, message: "Zapisałem — przepis pojawi się za chwilę"}

### Faza 3: Recipe list UI + detail view
- Create `src/app/(authenticated)/recipes/page.tsx` (Server Component):
  - Query user's recipes sorted by created_at DESC
  - Display as grid of cards: image + title + category tag
  - Empty state: "Brak przepisów. Udostępnij link z Facebooka!"
- Create `src/app/(authenticated)/recipes/[slug]/page.tsx` (Server Component):
  - Query single recipe by slug + auth check (RLS)
  - Display: full image, title, category, source badge ("Facebook"), "Otwórz oryginał" button
  - Ingredients: formatted UL with amount + unit + name
  - Steps: formatted OL
  - Delete button (soft-delete or hard? → decide in p3 review)
- Create `src/app/components/recipe-card.tsx` (Client or Server):
  - Image + title + category; click → navigate to [slug]
- Add `/recipes` to layout navigation (top bar or drawer)
- Styling: Tailwind v4 consistent with existing auth pages

### Faza 4: Share intent integration + redirect
- Modify `src/app/share/route.ts` (POST /share handler):
  - Currently: logs share, redirects to `/`
  - Updated: extract {url, title, text} from formData
  - Call server action triggerRecipeExtraction(url, title, text)
  - Return HTML form auto-submit to redirect to `/recipes` (or show toast + auto-navigate)
  - Note: user may not be logged in yet (share can happen before login) → S-01 scope: require login before sharing (guard in /share endpoint or middleware)

## Checklist testowania

- [ ] Build succeeds: `pnpm build`
- [ ] Migration: `pnpm exec supabase db push --linked` (local & test env)
- [ ] Task test: `npx trigger.dev dev` + POST /share with test URL → Trigger.dev dashboard shows completed run
- [ ] List page: Login → /recipes → card grid displays
- [ ] Detail page: Click card → [slug] page loads full recipe
- [ ] Web Share Target: Pixel 9 Android Chrome → share URL → form submits → "Zapisałem" → /recipes auto-navigates or shows toast
- [ ] RLS: Query own recipes ✓, attempt to query other user's recipes ✗

## Otwarte pytania / Decyzje

1. **Soft-delete vs hard-delete**: Should delete button soft-delete or hard-delete recipe? (PR-011 mentions archive/recycle bin) → MVP hard-delete for simplicity, refine in V2
2. **Approval flow**: Mama nie jest tech-savvy — czy ekstrakcja zawsze powinna udać się w best-effort mode (zapisz og:image + tytuł + URL + "niekompletna ekstrakcja" tag) czy fail hard? → Best-effort per PRD Sokrates rule
3. **Login wall before share**: Web Share Target fires POST /share; user may not be logged in. Guard in endpoint (redirect to /login after share) or in middleware? → Decide in p4 implementation, MVP probably requires login first

## Ryzyka

- **FB scraping rate-limits / bot detection**: Firecrawl handles some of this, but may fail on heavily protected posts. Best-effort + error handling mitigates.
- **LLM hallucination**: gpt-4o-mini may invent ingredients/steps if source is noisy. Polish sample corpus & iterate prompt per first 10-20 recipes.
- **Image hosting**: Firecrawl og:image may be FB-hosted (expiring URL) → need to download + upload to Supabase storage? → MVP: store URL as-is, S-02 refines
- **Category consistency**: Fixed taxonomy may assign same recipe to different categories on retry. Fixed prompt + audit first ~20 → refine taxonomy if needed.

## Definition of Done

- PR merged to master
- Build succeeds in production
- Pixel 9 manual test: Web Share + /recipes list/detail all working
- Trigger.dev dashboard shows ≥1 successful extraction
- RLS verified (user isolation tested)
- README updated with S-01 section (recipe schema, Firecrawl setup, OpenAI prompt)
