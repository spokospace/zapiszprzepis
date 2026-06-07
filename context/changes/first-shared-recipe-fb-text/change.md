---
change_id: first-shared-recipe-fb-text
title: Pierwszy udostępniony przepis (FB tekstowy)
status: in_progress
phases_completed: 3
phases_total: 4
started_at: 2026-06-07
---

# S-01 Progress

## Phase 1: Recipe schema + RLS + DB migrations
**Status**: ✓ completed  
**Objective**: Create `recipes` and `recipe_shares` tables with RLS, run migrations, verify typegen

**Files to create/modify**:
- `supabase/migrations/0002_recipe_schema.sql` — schema
- `src/lib/supabase.types.ts` — regenerated after migration
- `.env.local` — ensure SUPABASE_URL + SUPABASE_ANON_KEY set

**Completion criteria**:
- [ ] Migration runs: `pnpm exec supabase db push --linked` succeeds
- [ ] Tables visible in Supabase dashboard
- [ ] RLS policies applied
- [ ] Typegen updates types

---

## Phase 2: Recipe extraction task (Trigger.dev)
**Status**: ✓ completed  
**Objective**: Implement Firecrawl + OpenAI extraction task, create server action to trigger it

**Files to create/modify**:
- `src/trigger/extract-recipe.ts` — main extraction task
- `src/app/share/actions.ts` — server action `triggerRecipeExtraction`
- `src/app/share/route.ts` — integrate server action call
- `.env.local` — add FIRECRAWL_API_KEY, OPENAI_API_KEY

**Completion criteria**:
- [ ] `npx trigger.dev dev` shows extract-recipe task registered
- [ ] POST /share with test URL triggers task
- [ ] Trigger.dev dashboard shows completed run
- [ ] Recipe inserted into DB with correct schema

---

## Phase 3: Recipe list UI + detail view
**Status**: ✓ completed  
**Objective**: Create recipes list page, detail page, recipe card component

**Files to create/modify**:
- `src/app/(authenticated)/recipes/page.tsx` — list page
- `src/app/(authenticated)/recipes/[slug]/page.tsx` — detail page
- `src/app/components/recipe-card.tsx` — card component
- `src/app/layout.tsx` — add /recipes nav link

**Completion criteria**:
- [ ] /recipes loads, displays user's recipes
- [ ] /recipes/[slug] loads and shows full recipe
- [ ] Styling consistent with existing pages
- [ ] Images load correctly

---

## Phase 4: Share intent integration + delete endpoint
**Status**: in progress
**Objective**: Complete recipe deletion + verify full flow

**Files to create/modify**:
- `src/app/api/recipes/delete/route.ts` — delete endpoint with RLS
- Test Web Share Target flow end-to-end

**Completion criteria**:
- [x] Web Share Target form submits → extraction triggered (Phase 2)
- [x] User redirected to /recipes (Phase 2 route.ts update)
- [x] RLS verified (user can only see own recipes in Phase 3)
- [ ] Delete endpoint working
- [ ] Full flow tested: share → extract → list → detail → delete

---

## Notes

- Requires env vars: FIRECRAWL_API_KEY (Firecrawl), OPENAI_API_KEY (OpenAI/gpt-4o-mini)
- Firecrawl: https://www.firecrawl.dev/ — create account + get API key
- OpenAI: https://platform.openai.com/account/api-keys — create API key
- See plan.md for full implementation guide
