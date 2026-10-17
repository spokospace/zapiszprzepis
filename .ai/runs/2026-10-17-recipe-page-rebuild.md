# Execution plan — Recipe page rebuild (E01-S07)

Source doc: .ai/specs/2026-10-17-recipe-page-rebuild.md
Spec PR: #245 · Issue: #210 (Refs only — never a closing keyword)

## Goal

Rebuild `/przepis/{slug}` per the spec: list bar with prev/next, rebuilt header, 32 px
checklists in sessionStorage with `Krok N z M`, text-size control, a locked gallery teaser
for guests, and extension slots for S06/S08/S16.

## Scope

- `src/app/przepis/[slug]/` (page + `_components/`), `src/lib/routes.ts`,
  new `src/lib/recipe-checklist.ts`, `src/lib/recipe-list-context.ts`,
  `src/app/components/recipe-card.tsx`, `src/app/components/recipe-list-snapshot.tsx`,
  list pages `/`, `/recipes`, `/ulubione` (snapshot wiring only).
- One owner-gated migration + rolled-back rehearsal (written, never applied).

## Non-goals

- Favorites behaviour (S06), cooking mode (S08), similar recipes/tag rework (S16),
  desktop layouts (S17), `/u/{username}` (S14), gender (S12).
- Applying the migration or `supabase db push`.

## Implementation Plan

Mirrors the spec's Implementation Plan (Phases 1–3, Steps 1–10).

## Risks

- The page runs against production Supabase locally; verification is read-only.
- Until the migration is applied the teaser/author link stay dormant (by design).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Header, checklists and text size

- [ ] 1.1 Checklist storage lib with tests
- [ ] 1.2 Recipe header and actions components
- [ ] 1.3 Ingredient and step checklists with text size
- [ ] 1.4 Canonical metadata and token restyle

### Phase 2: List context

- [ ] 2.1 List-context lib and route helpers with tests
- [ ] 2.2 List snapshot component and list-page wiring
- [ ] 2.3 Category context and list bar

### Phase 3: Gallery teaser and author link

- [ ] 3.1 View migration and rolled-back rehearsal
- [ ] 3.2 Locked gallery and author link
- [ ] 3.3 Dev-server verification and full gate
