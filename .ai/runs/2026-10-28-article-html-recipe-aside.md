# Execution plan — keep a recipe card inside `<aside>` / `<form>` in articleHtml

- Date: 2026-10-28
- Slug: article-html-recipe-aside
- Branch: fix/article-html-recipe-aside
- Base: master
- Issue: #562
- Engine: om-auto-create-pr (steps: 3, --loop: no)

## Goal

`articleHtml()` (`src/lib/article-html.ts`) must not drop an `<aside>` or `<form>` that holds the recipe card (WPRM, Tasty Recipes, Mediavine Create, schema.org `Recipe` microdata, or an ingredients list), while still dropping ordinary sidebars and newsletter forms.

## Scope

- `src/lib/article-html.ts`: strip `nav|footer|button|select` first, then strip `aside|form` only when the block has no recipe markup. A kept `aside`/`form` keeps its contents (minus the buttons/selects already removed); the tag itself loses its attributes like every other tag.
- `src/lib/article-html.test.ts`: recipe card in `<aside>`, ingredient list in `<form>`, and a plain sidebar/newsletter form still dropped.

## Non-goals

- No change to `readableHtml`, the extraction prompt, the HTML cap, or the Jina/markdown path.
- No HTML parser dependency; nested `<aside>` inside `<aside>` stays a known regex limitation.

## Implementation Plan

### Phase 1: Keep recipe asides and forms

1. Split the chrome-stripping regex and add a recipe-markup check for `aside`/`form`.
2. Add unit tests for kept and dropped blocks.
3. Run the validation gate.

## Risks

- A sidebar widget that mentions "ingredient" in a class (e.g. a "popular ingredients" tag cloud) would now be kept. Low impact: it only adds some noise to the LLM's view, which is the old behaviour minus one stripped block.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Keep recipe asides and forms

- [ ] 1.1 Keep aside/form blocks that hold recipe markup
- [ ] 1.2 Unit tests for kept and dropped blocks
- [ ] 1.3 Full validation gate
