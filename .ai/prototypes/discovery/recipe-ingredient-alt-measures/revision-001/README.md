# Discovery prototype — alternative household measures on the ingredient list

- **Revision:** revision-001 · **Date:** 2026-10-24 · **Previous revision:** none
- **Slug:** `recipe-ingredient-alt-measures`
- **Design authority (used as the brief):** GitHub issue [#505](https://github.com/spokospace/zapiszprzepis/issues/505) — "Implement: capture and show alternative household measures for ingredients". No `.ai/specs/product-brief.md` exists; #505 carries the scope, non-goals and done-when this prototype honours.
- **Panel report:** none supplied (direct invocation, no `om-synthetic-users` panel run).
- **Reference source behaviour:** aniagotuje.pl ingredient lists ("250 g mąki … – ok. 1,5 szklanki", "150 g masła – 3/4 kostki"), supplied by the user as a screenshot.

## What this prototype tests

How to **display** a household measure (szklanki / kostki / łyżki) beside the precise metric amount on the recipe page's ingredient list — in both the **desktop** panel layout and the **mobile** single-column layout — so the owner can approve the visual treatment before `#505` is implemented.

- **Actor:** any recipe reader (guest or signed-in).
- **Starting point:** a recipe detail page `/przepis/{slug}` with sectioned ingredients.
- **Success outcome:** the reader sees, per ingredient that has one, the household measure as clearly *secondary* information, without losing the metric amount or cluttering the line.
- **Screens / states included:** the ingredients block in two frames (desktop ≥ lg panel + mobile phone), two candidate treatments, the checked (crossed-off) state, and ingredients with **no** alt measure.
- **Excluded (out of scope here):** the extraction pipeline, the steps column (shown as a ghost placeholder), the `.md`/JSON-LD outputs, and any add/edit UI. These are honestly represented as not simulated.

## Treatments shown

1. **Second line (recommended, default).** Metric amount + name on the 19 px main line; the household measure on a separate 16 px `text-ink-soft` line beneath. Keeps the main line clean and the alt clearly secondary.
2. **Inline, after a middot.** `… tortowej · ok. 1,5 szklanki` appended muted on the same line — closer to Aniagotuje's layout. The browser walk shows it dangles onto a second line at panel width (`· ok. / 3/4 szklanki`), which reads worse at the large Android font the older target group uses — captured as evidence for the decision, not as a recommendation.

## Business rules / decisions preserved (from #505 and CLAUDE.md)

- `[DECISION #505]` **No DB column / no migration** — the alt measure is an additive optional field inside the existing `recipes.ingredients` jsonb; the prototype reflects a per-ingredient `alt` string. Owner: `spokospace`. Status: filed in #505. Change path: edit #505.
- `[DECISION #505]` **No unit conversion on our side** — store/show the source's measure verbatim (Polish). The simulated data uses source-style strings only.
- `[RULE CLAUDE.md]` WCAG 2.2 AA: helper/secondary text ≥ 16 px in `#374151` (`--color-ink-soft`), 19 px content, 56 px touch rows, visible focus (`3px #1d4ed8`), no horizontal page scroll (WCAG 1.4.10). The prototype uses these exact tokens.
- `[NON-GOAL #505]` no editing UI, no per-serving scaling of the alt measure — not simulated.

## Assumptions

- `[ASSUMPTION A1]` **Faithful styling instead of neutral grayscale.** This skill defaults to a neutral low-fi wireframe; here the design system is already settled (`src/app/globals.css`, the shipped recipe page) and the decision under test *is* the visual treatment on the real panel, which a grayscale mock cannot answer. The prototype therefore reuses the real color tokens and layout proportions (1fr 1.6fr desktop grid, 56 px rows, `surface-2` panel). Check: compare against the live `/przepis/{slug}` page. This deviation is recorded here, not hidden.
- `[ASSUMPTION A2]` **Second-line treatment is preferable** for readability at large font. Check: a synthetic or real reader walk, or the owner's judgement from the evidence screenshots.
- `[ASSUMPTION A3]` Fictitious carrot-cake / buttercream data, chosen to mix ingredients with and without an alt measure across two sections. Not production data.
- `[ASSUMPTION A4]` Servings line "na 12 porcji" is illustrative only.

## Screen / state map

| Screen / state | Action | Expected next state | Refs |
|---|---|---|---|
| Entry (desktop + mobile, second-line variant) | load | Both frames list ingredients; alt measure on its own 16 px muted line; no-alt rows show no extra line | A1, A3, DECISION #505 |
| Variant switch | select "W tej samej linii" | Alt measure moves inline after `·`; note text updates | A2 |
| Tick ingredient | click row/checkbox | Green check + strikethrough on name **and** alt measure | RULE CLAUDE.md |
| No-alt ingredient (4 jajka, proszek, cynamon, mascarpone, orzechy) | load | Single line, no dangling dash/brackets | done-when #505 |
| Reset | click "Resetuj" | Clears ticks, returns to recommended variant, focus to default radio | — |

## Browser verification (built-in browser, file:// snapshot)

| Check | Result | Evidence |
|---|---|---|
| Desktop panel, recommended treatment | ✅ metric prominent, alt secondary below; "4 jajka" no alt line | `evidence/01-desktop-secondline-recommended.jpg` |
| "Krem" section + mobile single column | ✅ "150 g masła / 3/4 kostki"; mobile frame readable | `evidence/02-krem-section-and-mobile.jpg` |
| Inline variant | ✅ renders; exposes second-line dangle at width | `evidence/03-desktop-inline-variant.jpg` |
| Checked state | ✅ check + strikethrough on name and alt | `evidence/04-checked-strikethrough.png` |
| Reflow at 360 px and 320 px | ✅ no horizontal overflow (`scrollWidth === innerWidth` at both) | `evidence/05-reflow-320px.png` |
| Keyboard focus ring on a checkbox | ✅ `:focus-visible` on the box computes to `3px solid #1d4ed8` | (computed-style check) |
| Entry variant deterministic | ✅ defaults to recommended "second line" after reload | — |

**Two fixes applied during this verification (same revision):**

- The keyboard focus ring was invisible on an unchecked ingredient checkbox (the real focus target is an `opacity:0` input, and the ring was on the hidden tick). Moved it to the visible box via `.box:has(input:focus-visible)` — WCAG 2.4.7.
- Forced the recommended "second line" variant as the deterministic entry state, so a browser restoring a previously selected radio across reload cannot start on the inline variant.

**Not applicable:** fragment / browser back-forward navigation — this is a single display screen, not a multi-screen flow. A full assistive-technology (screen-reader) pass is out of scope for a low-fi prototype and would be re-checked on the real implementation (#505) by `pnpm test:reflow` + the a11y review.

## How to open

Open `index.html` in any browser (double-click, or `file://` path). It runs fully offline, loads no external resource, and stores nothing. "Resetuj" restores the start.

> This artifact contains **fictitious** simulation data. It demonstrates a display treatment; it does **not** establish user demand, research evidence, or production readiness, and does not satisfy the Definition of Ready.
