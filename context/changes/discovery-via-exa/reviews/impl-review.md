<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Discovery via Exa

- **Plan**: context/changes/discovery-via-exa/plan.md
- **Scope**: All phases (Phase 1 + Phase 2)
- **Date**: 2026-07-05
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 7 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — `contents.highlights` enabled without plan documentation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/app/(authenticated)/recipes/search-via-exa-action.ts:47–49
- **Detail**: Plan specified `{ query, numResults: 5, type: 'auto' }` without highlights. Implementation adds `contents.highlights` to get 3 recipe-focused sentences per result. Correct decision (without it Exa returns unparseable raw page text), but undocumented in plan.
- **Fix**: Added comment in search-via-exa-action.ts explaining the decision. Addendum added in plan.md "Czego NIE robimy" section.
- **Decision**: FIXED

### F2 — Tab UX differs from unified-input described in plan

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/app/components/add-recipe-form.tsx
- **Detail**: Plan described a unified input with automatic URL vs. query detection (`startsWith('http://')`). Delivered: two explicit tabs (`'search'` | `'add'`). Cleaner UX but different from spec.
- **Fix**: Addendum added in plan.md Faza 2 overview explaining the tab UX as the delivered shape.
- **Decision**: FIXED (documented)

### F3 — Supabase query error silently swallowed

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/(authenticated)/recipes/search-via-exa-action.ts:65–70
- **Detail**: `alreadySaved` query result was destructured without error check; query failures silently fell back to empty savedUrls set.
- **Fix**: Added `error: savedRowsError` destructuring and `console.error` on failure.
- **Decision**: FIXED

### F4 — Empty query reaches Exa API

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/(authenticated)/recipes/search-via-exa-action.ts:32
- **Detail**: No guard against empty/whitespace-only query before calling Exa API.
- **Fix**: Added `if (!query.trim()) return { results: [] }` after requireUser().
- **Decision**: FIXED

### F5 — All manual success criteria unchecked

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: plan.md:269–287
- **Detail**: 8 manual checklist items (1.3–1.5, 2.3–2.8) remain unchecked. Includes live Exa call, bad API key handling, dev start error, URL flow regression, search panel, badge, Zapisz, error state, no results. Could not be automated in this review (requires authenticated prod session).
- **Fix**: Deferred — user must test manually while logged in to zapiszprzepis.pl. Items 1.4 and 1.5 require dev server with modified secrets.
- **Decision**: DEFERRED

### F6 — Plan said eager init, implementation does lazy load

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md:61–62
- **Detail**: Plan wrote "throw at module load when missing" suggesting eager init. Implementation correctly uses `getExaApiKey()` as a lazy function — required by Cloudflare Workers (module-level eager init fails during edge build). Code is correct; plan was inaccurate.
- **Decision**: SKIPPED — implementation is correct for CF Workers runtime

### F7 — Raw Exa error body transmitted to client

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/(authenticated)/recipes/search-via-exa-action.ts:54–57
- **Detail**: When Exa returns non-OK status, raw response body (including Exa's error message) was returned in `{ error: string }` to the client. No secrets in the error, but exposes internal API error details unnecessarily.
- **Fix**: Now logs `console.error('[searchViaExa] Exa API error', res.status, text)` and returns `{ error: 'exa_unavailable' }`. Client UI shows "Wyszukiwanie niedostępne — wklej link ręcznie." (hardcoded in add-recipe-form.tsx:190).
- **Decision**: FIXED

### F8 — add-recipe-action.ts modified despite plan's scope restriction

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: plan.md:38, src/app/(authenticated)/recipes/add-recipe-action.ts
- **Detail**: Plan stated "Nie modyfikujemy add-recipe-action.ts". Three redirect targets (`/recipes?add_error=` → `/?add_error=`) were changed when the form moved to the home page.
- **Decision**: SKIPPED — cascading change from home page relocation; addendum in plan.md documents it

### F9 — Home page relocation out of original plan scope

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/app/page.tsx
- **Detail**: `AddRecipeForm` moved from `/recipes` to `/` (home page) after implementation. Not in original plan — product decision made after delivery.
- **Decision**: SKIPPED — addendum in plan.md Faza 2 and "Czego NIE robimy" document the rationale
