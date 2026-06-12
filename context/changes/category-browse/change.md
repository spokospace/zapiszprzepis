---
change_id: category-browse
title: Category browse (S-05)
status: implemented
created: 2026-06-07
updated: 2026-06-12
archived_at: null
---

## Notes

browse recipes by category — mama clicks a category chip on /recipes and sees only that category's recipes. Categories are assigned automatically by the LLM during extraction (S-01..S-04). Shipped via feat/category-browse (PR #50): an inline CategoryFilter chip row (icons + per-category counts, active-state toggle) that pushes `/recipes?category=X`, server-side filtering on the recipes page, and a category badge on the recipe detail that links back to the filtered list. The plan's optional Faza 2 (a dedicated `/recipes/categories` landing page) was intentionally skipped — the inline chips satisfy the Definition of Done. See [[local-dev-against-prod]].
