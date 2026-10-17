# E01-S23 — Gendered wording in public texts (Dodała/Dodał)

Source doc: .ai/design/przebudowa-handoff/README.md
Refs #290 (epic #201). Owner decision: `.ai/analysis/2026-10-17-design-gap-audit.md`, "Do decyzji" pt 1.

## Goal

Public texts follow the gender the author chose once at first login (3b), while guests only ever
receive a grammatical form ('f' | 'm' | null), never raw gender and never a read on
`profiles_private`.

## Scope

- Migration (owner-gated, NOT applied by this run): `author_gender_form` appended to the
  `public_recipes` view (runs as owner, like `author_name`), and `public.profile_gender_form(username)`
  (SECURITY DEFINER, returns only 'f' | 'm' | null) for `/u/{username}`. No grant on `profiles_private`.
- Rolled-back rehearsal in `.ai/qa/` asserting the form and the privacy (anon cannot read
  `profiles_private`, the view exposes no raw gender column).
- One Polish verb-form helper (`src/lib/gender-form.ts`) with unit tests.
- Wording on: recipe author line, public profile count line + empty state, settings preview (2a).
- App degrades to neutral wording before the migration is applied.

## Non-goals

- Applying the migration to prod or running `supabase db push`.
- Profile/list card layout (S22, #289 runs in parallel) — only the wording lines change.
- Any other gendered text (home greeting, notifications).

## Risks

- Privacy: a form is derived from gender, so it reveals the same bit — accepted by the owner
  (the text itself is gendered). The risk to avoid is exposing more (raw column, other private
  fields, table grant). Mitigated by a narrow function/view column + rehearsal + unit tests.
- Deploy order: the app must render neutral wording while the column/function are missing.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database

- [ ] 1.1 Migration exposing author_gender_form and profile_gender_form
- [ ] 1.2 Rolled-back rehearsal asserting form and privacy

### Phase 2: App

- [ ] 2.1 Polish verb-form helper with tests
- [ ] 2.2 Recipe author line
- [ ] 2.3 Public profile count line and empty state
- [ ] 2.4 Settings preview

### Phase 3: Verification

- [ ] 3.1 Local gate and live neutral-fallback check
