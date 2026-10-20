# Backlogs

Source-to-issue map maintained by `om-backlog`. The tracker is the live
authority; this file keeps the id→issue mapping and reserved ids per source.

## .ai/specs/backlog-przebudowa.md

Backlog source: `.ai/specs/backlog-przebudowa.md`
Last filed: 2026-10-16 · re-synced 2026-10-19 · extended 2026-10-19 (handoff v8)
Tracker: GitHub `spokospace/zapiszprzepis`

Epic E01 (public, high-readability rebuild): the first run filed 18 stories
across 4 waves, all with new ids and no adoptions; the 2026-10-19 re-sync below
adopted ten more entries. S01, S02, S18 were filed and then **closed** because the work
had already merged to `master` (PRs linked in each issue) — filed so the E01
tracker record is complete.

E01-S03 was split (2026-10-16) into **S03a** (#204 — global dedup + first-adder
ownership + source label; already designed in `2026-10-16-global-recipe-dedup-przepis-slug.md`,
PR #199) and **S03b** (#220 — `/przepis/{slug}` + 301; spec authored in this run).

Re-sync 2026-10-19: no new issues filed. Ten issues opened under #201 after the
first run (mostly from the design-gap audit `.ai/analysis/2026-10-17-design-gap-audit.md`,
design authority `.ai/design/przebudowa-handoff/README.md`) were adopted:
the `Backlog source:` / `Backlog id:` lines were added to their bodies, with an
adoption comment on each. S15–S17 statuses were refreshed to closed.
S04–S11, S13, S14 were closed the same day on the owner's confirmation: their
implementation PRs had merged but referenced the issues with `Refs`, so GitHub
never closed them. Only S12 (#205) stays open, waiting on #299 / #288.

Extension 2026-10-19 (handoff v8): four new stories S24–S27 filed from the
owner's design handoff v8, imported to `.ai/design/przebudowa-handoff/`
(`ZMIANY_nawigacja_mobile.md`, `ISSUE_lupa_szukaj.md`, screen 4 in README) — the
two-word name „Zapisz Przepis”, the mobile header with „Szukaj” instead of
„Dodaj” and a text-only logo (supersedes the #328/#331 mobile-logo rule),
full-screen `/szukaj` and voice search. No adoptions: no open or closed issue
covered them.

Extension 2026-10-20 (v8 gap review against production): S28 (recipe page header
per C3 — „← {lista}” in the header, the list bar and „N z M” dropped below lg;
owner decision, supersedes #324 for the recipe page), S29 (type-ahead
suggestions) and S30 („W serwisie” / „Na blogach” tabs) — the last two parked
by the owner until S24–S28 ship.

| Id | Issue | Title | Epic | Depends on | Adopted | Status |
|---|---|---|---|---|---|---|
| E01 | [#201](https://github.com/spokospace/zapiszprzepis/issues/201) | Rebuild ZapiszPrzepis as a public, high-readability app | — | — | no | open |
| E01-S01 | [#202](https://github.com/spokospace/zapiszprzepis/issues/202) | Design system and readability tokens | #201 | — | no | closed · shipped #195 |
| E01-S02 | [#203](https://github.com/spokospace/zapiszprzepis/issues/203) | Public access: pages leave (authenticated) + anon RLS | #201 | E01-S18 | no | closed · shipped #193, #194 |
| E01-S03a | [#204](https://github.com/spokospace/zapiszprzepis/issues/204) | One recipe per link: global dedup + first-adder ownership | #201 | E01-S06, E01-S18, E01-S02 | no | ✅ closed · live on prod (#223, #235, #236); collapse merge_id 4a74ec54 |
| E01-S03b | [#220](https://github.com/spokospace/zapiszprzepis/issues/220) | Public /przepis/{slug} route + 301 from /recipes | #201 | E01-S03a, E01-S02 | no | closed · shipped #239 (spec #221) |
| E01-S12 | [#205](https://github.com/spokospace/zapiszprzepis/issues/205) | OAuth Facebook/Google login + first-login gender + vocative | #201 | E01-S02 | no | open |
| E01-S18 | [#206](https://github.com/spokospace/zapiszprzepis/issues/206) | Identity: display name + username | #201 | — | no | closed · shipped #192 |
| E01-S04 | [#207](https://github.com/spokospace/zapiszprzepis/issues/207) | Home page: guest and logged-in | #201 | E01-S01, E01-S02 | no | closed · shipped #249 |
| E01-S05 | [#208](https://github.com/spokospace/zapiszprzepis/issues/208) | One search with results and scope (All/Mine/Favorites) | #201 | E01-S01, E01-S02 | no | closed · shipped #262 |
| E01-S06 | [#209](https://github.com/spokospace/zapiszprzepis/issues/209) | Favorites: labelled heart + guest→login→save flow | #201 | E01-S02 | no | closed · shipped #260 |
| E01-S07 | [#210](https://github.com/spokospace/zapiszprzepis/issues/210) | Recipe page rebuild | #201 | E01-S01, E01-S02, E01-S03a, E01-S03b | no | closed · shipped #246 |
| E01-S08 | [#211](https://github.com/spokospace/zapiszprzepis/issues/211) | Cooking mode (fullscreen, Wake Lock) | #201 | E01-S01, E01-S07 | no | closed · shipped #274 |
| E01-S09 | [#212](https://github.com/spokospace/zapiszprzepis/issues/212) | Menu drawer: Mine + All by category | #201 | E01-S01 | no | closed · shipped #250 |
| E01-S10 | [#213](https://github.com/spokospace/zapiszprzepis/issues/213) | Add recipe: dedicated /dodaj page | #201 | E01-S01, E01-S11 | no | closed · shipped #269 |
| E01-S11 | [#214](https://github.com/spokospace/zapiszprzepis/issues/214) | Add gate: access code (screen 3c) | #201 | E01-S02 | no | closed · shipped #251 |
| E01-S13 | [#215](https://github.com/spokospace/zapiszprzepis/issues/215) | My profile / Settings (/settings) | #201 | E01-S01, E01-S12, E01-S03a, E01-S03b, E01-S18 | no | closed · shipped #263 |
| E01-S14 | [#216](https://github.com/spokospace/zapiszprzepis/issues/216) | Public profile (/u/{username}) | #201 | E01-S02, E01-S03a, E01-S03b, E01-S18 | no | closed · shipped #259 |
| E01-S15 | [#217](https://github.com/spokospace/zapiszprzepis/issues/217) | Notifications: fullscreen + home banner | #201 | E01-S01 | no | closed |
| E01-S16 | [#218](https://github.com/spokospace/zapiszprzepis/issues/218) | Category with tags + similar recipes | #201 | E01-S01, E01-S03a, E01-S03b | no | closed |
| E01-S17 | [#219](https://github.com/spokospace/zapiszprzepis/issues/219) | Desktop layouts (A8, A9) | #201 | E01-S01, E01-S04, E01-S05, E01-S07 | no | closed |
| E01-S07b | [#279](https://github.com/spokospace/zapiszprzepis/issues/279) | Recipe page fixes per design handoff (C3) | #201 | — | yes | closed · shipped #287 |
| E01-S12b | [#281](https://github.com/spokospace/zapiszprzepis/issues/281) | Login 3a, first-login 3b and code gate 3c per design handoff | #201 | — | yes | closed · shipped #285 |
| E01-S12-T01 | [#299](https://github.com/spokospace/zapiszprzepis/issues/299) | Enable S12 OAuth login (Facebook + Google): provider setup + merge #288 | Story #205 | — | yes | open · manual provider setup before merging #288 |
| E01-S13b | [#282](https://github.com/spokospace/zapiszprzepis/issues/282) | Settings fixes per design handoff (2a) | #201 | — | yes | closed · shipped #284 |
| E01-S19 | [#278](https://github.com/spokospace/zapiszprzepis/issues/278) | Mobile header and menu per design handoff | #201 | — | yes | closed · shipped #286 |
| E01-S20 | [#280](https://github.com/spokospace/zapiszprzepis/issues/280) | Home page visuals per design handoff (C1/A1) | #201 | — | yes | closed · shipped #283 |
| E01-S21 | [#296](https://github.com/spokospace/zapiszprzepis/issues/296) | Versions of the same dish (dish / variant_note) | #201 | — | yes | closed · shipped #301 (spec #297) |
| E01-S21-T01 | [#298](https://github.com/spokospace/zapiszprzepis/issues/298) | Backfill dish / variant_note for existing recipes (Claude-authored data migration) | Story #296 | — | yes | closed · applied on prod |
| E01-S22 | [#289](https://github.com/spokospace/zapiszprzepis/issues/289) | Shared list card + favorites bar (search, category, profile) | #201 | — | yes | closed · shipped #292 |
| E01-S23 | [#290](https://github.com/spokospace/zapiszprzepis/issues/290) | Gendered wording in public texts (Dodała/Dodał) | #201 | — | yes | closed · shipped #291 |
| E01-S24 | [#339](https://github.com/spokospace/zapiszprzepis/issues/339) | The app is called „Zapisz Przepis” everywhere | #201 | — | no | open |
| E01-S25 | [#340](https://github.com/spokospace/zapiszprzepis/issues/340) | Below lg the header shows „Zapisz Przepis” · „Szukaj” · „MENU” for everyone | #201 | E01-S24 | no | open |
| E01-S26 | [#341](https://github.com/spokospace/zapiszprzepis/issues/341) | Below lg, /szukaj opens as a full-screen search with recent and popular searches | #201 | E01-S25 | no | open |
| E01-S27 | [#342](https://github.com/spokospace/zapiszprzepis/issues/342) | A user can search by voice with „Powiedz” and sees what was heard | #201 | E01-S26 | no | open |
| E01-S28 | [#344](https://github.com/spokospace/zapiszprzepis/issues/344) | Below lg the recipe page header leads back to the list („← Wyniki”) instead of a separate list bar | #201 | E01-S25 | no | open |
| E01-S29 | [#345](https://github.com/spokospace/zapiszprzepis/issues/345) | While typing a search, a user sees up to 4 recipe suggestions and „Pokaż wszystkie wyniki” | #201 | E01-S26 | no | open |
| E01-S30 | [#346](https://github.com/spokospace/zapiszprzepis/issues/346) | Search results split into „W serwisie” and „Na blogach” tabs | #201 | E01-S26 | no | open |

Reserved ids: E01-S01 … E01-S30, plus E01-S03a / E01-S03b (S03 split; the bare
`E01-S03` id is retired, not reused), E01-S07b, E01-S12b, E01-S13b, and tasks
E01-S12-T01, E01-S21-T01. Next new story would be E01-S31.

Outside the tree (not E01 outcomes, deliberately not adopted): #225–#233
(listing/performance refactors), #116, #132, #188, #307.
