# E01-S14 — Public profile (`/u/{username}`) — execution plan

Source doc: `.ai/specs/2026-10-17-e01-s14-public-profile.md` (spec PR #257)
Issue: #216 (Refs only — no closing keyword)

## Goal

Ship the public `/u/{username}` page and switch on S07's recipe-page author link, reading only anon-readable data (`profiles`, `public_recipes`). No migration.

## Scope

- New: `src/lib/public-profile.ts` (+ tests), `src/app/components/profile-avatar.tsx`, `src/app/u/layout.tsx`, `src/app/u/[username]/page.tsx`, six `--color-avatar-N` tokens.
- Edited: `src/lib/routes.ts` (+ tests) — `PROFILE_PAGE_RE`, `isPublicRoute`, `profilePath` without the switch; comment-only edit in `recipe-header.tsx`.

## Non-goals

- Gendered "Dodała/Dodał" (spec A1), avatar upload (S13), list-bar `from` key (A4), sitemap.
- Any recipe-page markup (S06/S16 own it in parallel).

## Risks

- Profile link and route must ship in one commit (no dead links).
- Parallel edits to `globals.css` / `routes.ts` by other E01 sessions → merge master before review and hand-off.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Helpers and routing seam

- [ ] 1.1 public-profile helpers and tests
- [ ] 1.2 PROFILE_PAGE_RE in isPublicRoute

### Phase 2: The page

- [ ] 2.1 Avatar tokens and ProfileAvatar
- [ ] 2.2 Profile route, layout and profilePath switch
- [ ] 2.3 Dev-server verification and full gate
