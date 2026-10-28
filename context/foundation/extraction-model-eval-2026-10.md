# Extraction-model evaluation — #526 (2026-10)

**Decision:** switch `EXTRACTION_MODEL` (Polish source) from `gpt-4o-mini` to
**`gpt-5.4-mini`**. Leave `FOREIGN_EXTRACTION_MODEL` (`gpt-4.1-mini`) unchanged
for now — see the foreign recommendation below.

## Why this evaluation

Polish recipes are extracted with `gpt-4o-mini`, the cheapest model. Production
data showed it breaks the extraction prompt's own rules — notably parking notes
and repeated amounts in the `alt` household-measure field. #525's `settleAlt`
guard repairs `alt` after the fact, but the same weak rule-following also hits
steps, times, servings and categories, where no guard exists. At a few dozen
recipes a month the price gap between the candidate models is cents, so the
decision turns on **rule-following quality and latency**, not cost.

## Method

Offline, read-only. Identical scraped input per recipe fed to every model, so
models are compared apples-to-apples (Firecrawl was out of monthly credits, so
every page was read via the Jina Reader fallback — one read per recipe, cached).

- **Dataset:** 26 already-saved recipes — 25 Polish (16 hosts: `aniagotuje.pl`,
  `blogzapetytem.pl`, `najprzepis.pl`, `zajadam.pl`, 3 Blogger feeds, 3 Facebook
  captions, …) + 1 foreign (`howsweeteats.com` prosciutto-fig pizza, id 1011).
- **Models (5):** `gpt-4o-mini` (baseline), `gpt-4.1-mini`, `gpt-5-mini`,
  `gpt-5-nano`, `gpt-5.4-mini`. Reasoning tiers run at their **lowest** effort
  (`minimal` for gpt-5 mini/nano; `none` for gpt-5.4-mini), since latency is the
  main risk.
- **Runs:** 2 per (recipe, model) to expose run-to-run variance. 260 calls, 0
  errors, 0 JSON parse failures.
- **Prompt:** verbatim copy of `extractWithLlm`'s system prompt (commit
  `0b42f20`) with the live rule constants imported, so nothing drifts.
- **Scoring reuses production logic:** `alt` violations = ingredients whose raw
  `alt`/`name` `settleAlt` (via `toIngredients`) would change — i.e. counted on
  the raw model JSON *before* the guard runs. Step-form = `isInstructionStep`.
  Category/servings compared to the stored recipe (reference, produced by the
  current pipeline — not ground truth). Prices: OpenAI list prices checked
  2026-10-25 (developers.openai.com/api/docs/pricing).

## Results

**Headline (lower is better; `n` = recipe-runs):**

| Model | n | parse-fail | alt viol (total / recipes) | step-form viol (total / recipes) | median lat | p95 lat | $/extraction |
|---|--:|--:|--:|--:|--:|--:|--:|
| gpt-4o-mini (current) | 52 | 0 | 48 / 20 | 83 / 16 | 8.1s | 12.5s | $0.0021 |
| gpt-4.1-mini | 52 | 0 | 97 / 27 | 29 / 9 | 6.0s | 10.6s | $0.0057 |
| gpt-5-mini | 52 | 0 | 104 / 27 | 10 / 9 | 10.8s | 18.3s | $0.0047 |
| gpt-5-nano | 52 | 0 | 14 / 10 | **224 / 38** | 5.5s | 9.8s | $0.0009 |
| **gpt-5.4-mini** | 52 | 0 | **23 / 10** | **1 / 1** | **3.8s** | **6.1s** | $0.0115 |

**Agreement with stored recipe + times:**

| Model | category match | servings match | times set | timesEstimated=true | EN leftovers |
|---|--:|--:|--:|--:|--:|
| gpt-4o-mini | 45/52 (87%) | 49/52 (94%) | 40 | 5 | 0 |
| gpt-4.1-mini | 44/52 (85%) | 45/52 (87%) | 48 | 9 | 0 |
| gpt-5-mini | 42/52 (81%) | 47/52 (90%) | 39 | 12 | 0 |
| gpt-5-nano | 35/52 (67%) | 47/52 (90%) | 38 | 0 | 4 (1 recipe) |
| gpt-5.4-mini | 42/52 (81%) | 42/52 (81%) | 39 | 3 | 0 |

**Run-to-run variance (# of 26 recipes where run1 ≠ run2):**

| Model | title≠ | category≠ | servings≠ | alt-viol≠ | step-count≠ |
|---|--:|--:|--:|--:|--:|
| gpt-4o-mini | 0 | 1 | 2 | 6 | 4 |
| gpt-4.1-mini | 0 | 0 | 1 | 11 | 7 |
| gpt-5-mini | 4 | 1 | 1 | 11 | 15 |
| gpt-5-nano | 4 | 8 | 1 | 7 | 14 |
| gpt-5.4-mini | 1 | 2 | 0 | 5 | 8 |

Mean tokens were ~10.3k input / ~0.9k output for every model; reasoning tokens
were 0 at the lowest effort, so cost is input-dominated.

## Interpretation

- **`gpt-5.4-mini` is the clear winner.** It roughly halves raw `alt` violations
  (23 vs 48) and cuts the recipes affected in half (10 vs 20) — directly
  shrinking what the #525 guard has to repair — and all but eliminates step-form
  violations (1 vs 83). It is the **fastest** model (p95 6.1s, less than half the
  current 12.5s) and the most stable run-to-run.
- Its lower category/servings "agreement" is **mostly it following the rules more
  strictly**, not regressing: bread/dough → `pieczywo` not `ciasta` (the current
  model confuses Polish *ciasto* = dough vs cake, e.g. "Ciasto na pizzę"), salads
  → `salatki` not `przekaski`, and returning `null` for implausible stored
  "servings" (36, 13, or 2 for a poppyseed roll — the "never estimate servings /
  a yield in pieces → null" rule). One mild debatable miss: a bare "Pizza" → `inne`
  rather than `obiady`.
- **`gpt-5-nano`** has the best `alt` score and lowest cost but is **disqualified**:
  224 step-form violations (it writes steps in the imperative — "Dodaj",
  "Rozgrzej" — instead of the required infinitive), worst category agreement
  (67%), and high variance.
- **`gpt-5-mini`** is slowest (p95 18.3s, near the 20s risk line) and worst on
  `alt` (104). **`gpt-4.1-mini`** is worse than the current model on `alt` (97 vs
  48). Neither is a win.

**Win criterion** (from the issue: "fewer rule violations with no worse p95
latency than 20 s") → `gpt-5.4-mini` passes decisively.

## Request-shape findings (issue open question)

Probed directly against each model:

- `gpt-4o-mini`, `gpt-4.1-mini`: accept the current request (`temperature: 0.3` +
  `response_format: json_object`) unchanged.
- `gpt-5-mini`, `gpt-5-nano`: **reject `temperature: 0.3`** ("only the default 1
  is supported"); require dropping `temperature` and adding
  `reasoning_effort` (lowest supported: `minimal`).
- `gpt-5.4-mini`: supports `reasoning_effort` `none`/`low`/`medium`/`high`/`xhigh`.
  Its **default and lowest effort is `none`**, at which `temperature: 0.3` +
  `json_object` are accepted. So switching to it is a bare one-line model change —
  **no request-body change needed.** (If OpenAI ever changes its default effort,
  an explicit `reasoning_effort: 'none'` on the Polish path would be required; the
  foreign path's `gpt-4.1-mini` rejects `reasoning_effort`, so it cannot be added
  unconditionally.)

## Foreign source — switched to `gpt-5.4-mini` (2026-10-28 follow-up)

The dedicated eval recommended below was run on 2026-10-28, after #557: 19
English recipes (recipetineats, bbcgoodfood, four Blogspot blogs, budgetbytes,
simplyrecipes, allrecipes), both models, 3 runs each, the production prompt
with a `"dishKind"` field written ahead of `"title"`. Two sites refused Jina (451)
and one page was a 404 (both models answered "no recipe", which the output
gate rejects), leaving 45 outputs for `gpt-4.1-mini` and 48 for `gpt-5.4-mini`.

- **Title** (a `gpt-4.1` judge: natural Polish naming the same dish): 36/45
  vs 40/48 — a tie. Both miss the same two pages (*Monster Cookies*, *scones*);
  `gpt-4.1-mini` also drops "hazelnut" from a cake title in all 3 runs.
- **US units left in steps**: 0/45 vs 4/48 outputs (5 hits: „7 uncjami”,
  °F). All of them are rewritten by `metricUnits` (`src/lib/us-units.ts`),
  which now runs on every step (a Polish blog can write "350°F" too), so the
  model's habit no longer reaches the saved recipe.
- **Steps**: `gpt-5.4-mini` keeps the author's paragraphs (mean 7.3 steps vs
  9.2); content was complete in both.

Decision: `FOREIGN_EXTRACTION_MODEL = EXTRACTION_MODEL`. One model for the
whole app, the unit conversion the prompt could not enforce moved into code,
and the `dishKind` field as the cheap stand-in for reasoning at effort `none`.

### Earlier note (2026-10-25, before the eval)

On the one foreign recipe (howsweeteats pizza), `gpt-5.4-mini` translated cleanly,
kept the infinitive step form, had 1/17 raw `alt` violations and no English
leftovers — ahead of the current `gpt-4.1-mini` (4/17). The owner's issue comment
documented `gpt-4.1-mini` translating inconsistently across refreshes. This hints
`gpt-5.4-mini` may also be the better `FOREIGN_EXTRACTION_MODEL`, but **one recipe
is not enough evidence** — recommend a dedicated foreign-source eval (varied US
blogs, multiple runs, scoring untranslated English + unit conversion) before
switching `FOREIGN_EXTRACTION_MODEL`.

## Note on a reported step ("brzmi dziwnie")

The step "W dużej misce połączyć wodę, drożdże, miód i oliwę z oliwek" flagged on
the live pizza is produced near-identically by **every** model, `gpt-5.4-mini`
included, and is **faithful** to the source (the howsweeteats dough really does
use water + yeast + honey + olive oil). The infinitive form is correct per
`STEP_FORM_RULE`. The model switch does not change this step; it is accurate, just
an unusual dough for a Polish cook.

## Limitations

- "Agreement" baselines are the current pipeline's own output, not ground truth.
- Foreign conclusions rest on a single recipe.
- Article pagination was not followed in the eval scrape (minor; most recipes fit
  one page).
- Numbers are at the models' lowest reasoning effort; higher effort was not tested
  (latency was the constraint).
