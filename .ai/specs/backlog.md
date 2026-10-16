# Backlogs

Source-to-issue map maintained by `om-backlog`. The tracker is the live
authority; this file keeps the id→issue mapping and reserved ids per source.

## .ai/specs/backlog-przebudowa.md

Backlog source: `.ai/specs/backlog-przebudowa.md`
Last filed: 2026-10-16
Tracker: GitHub `spokospace/zapiszprzepis`

Epic E01 (public, high-readability rebuild), 18 stories across 4 waves. All ids
new; no adoptions. S01, S02, S18 were filed and then **closed** because the work
had already merged to `master` (PRs linked in each issue) — filed so the E01
tracker record is complete.

E01-S03 was split (2026-10-16) into **S03a** (#204 — global dedup + first-adder
ownership + source label; already designed in `2026-10-16-global-recipe-dedup-przepis-slug.md`,
PR #199) and **S03b** (#220 — `/przepis/{slug}` + 301; spec authored in this run).

| Id | Issue | Title | Epic | Depends on | Adopted | Status |
|---|---|---|---|---|---|---|
| E01 | [#201](https://github.com/spokospace/zapiszprzepis/issues/201) | Rebuild ZapiszPrzepis as a public, high-readability app | — | — | no | open |
| E01-S01 | [#202](https://github.com/spokospace/zapiszprzepis/issues/202) | Design system and readability tokens | #201 | — | no | closed · shipped #195 |
| E01-S02 | [#203](https://github.com/spokospace/zapiszprzepis/issues/203) | Public access: pages leave (authenticated) + anon RLS | #201 | E01-S18 | no | closed · shipped #193, #194 |
| E01-S03a | [#204](https://github.com/spokospace/zapiszprzepis/issues/204) | One recipe per link: global dedup + first-adder ownership | #201 | E01-S06, E01-S18, E01-S02 | no | ✅ closed · live on prod (#223, #235, #236); collapse merge_id 4a74ec54 |
| E01-S03b | [#220](https://github.com/spokospace/zapiszprzepis/issues/220) | Public /przepis/{slug} route + 301 from /recipes | #201 | E01-S03a, E01-S02 | no | open · spec in progress |
| E01-S12 | [#205](https://github.com/spokospace/zapiszprzepis/issues/205) | OAuth Facebook/Google login + first-login gender + vocative | #201 | E01-S02 | no | open |
| E01-S18 | [#206](https://github.com/spokospace/zapiszprzepis/issues/206) | Identity: display name + username | #201 | — | no | closed · shipped #192 |
| E01-S04 | [#207](https://github.com/spokospace/zapiszprzepis/issues/207) | Home page: guest and logged-in | #201 | E01-S01, E01-S02 | no | open |
| E01-S05 | [#208](https://github.com/spokospace/zapiszprzepis/issues/208) | One search with results and scope (All/Mine/Favorites) | #201 | E01-S01, E01-S02 | no | open |
| E01-S06 | [#209](https://github.com/spokospace/zapiszprzepis/issues/209) | Favorites: labelled heart + guest→login→save flow | #201 | E01-S02 | no | open |
| E01-S07 | [#210](https://github.com/spokospace/zapiszprzepis/issues/210) | Recipe page rebuild | #201 | E01-S01, E01-S02, E01-S03 | no | open |
| E01-S08 | [#211](https://github.com/spokospace/zapiszprzepis/issues/211) | Cooking mode (fullscreen, Wake Lock) | #201 | E01-S01, E01-S07 | no | open |
| E01-S09 | [#212](https://github.com/spokospace/zapiszprzepis/issues/212) | Menu drawer: Mine + All by category | #201 | E01-S01 | no | open |
| E01-S10 | [#213](https://github.com/spokospace/zapiszprzepis/issues/213) | Add recipe: dedicated /dodaj page | #201 | E01-S01, E01-S11 | no | open |
| E01-S11 | [#214](https://github.com/spokospace/zapiszprzepis/issues/214) | Add gate: access code (screen 3c) | #201 | E01-S02 | no | open |
| E01-S13 | [#215](https://github.com/spokospace/zapiszprzepis/issues/215) | My profile / Settings (/settings) | #201 | E01-S01, E01-S12, E01-S03, E01-S18 | no | open |
| E01-S14 | [#216](https://github.com/spokospace/zapiszprzepis/issues/216) | Public profile (/u/{username}) | #201 | E01-S02, E01-S03, E01-S18 | no | open |
| E01-S15 | [#217](https://github.com/spokospace/zapiszprzepis/issues/217) | Notifications: fullscreen + home banner | #201 | E01-S01 | no | open |
| E01-S16 | [#218](https://github.com/spokospace/zapiszprzepis/issues/218) | Category with tags + similar recipes | #201 | E01-S01, E01-S03 | no | open |
| E01-S17 | [#219](https://github.com/spokospace/zapiszprzepis/issues/219) | Desktop layouts (A8, A9) | #201 | E01-S01, E01-S04, E01-S05, E01-S07 | no | open |

Reserved ids: E01-S01 … E01-S18, plus E01-S03a / E01-S03b (S03 split; the bare
`E01-S03` id is retired, not reused). Next new story would be E01-S19.
