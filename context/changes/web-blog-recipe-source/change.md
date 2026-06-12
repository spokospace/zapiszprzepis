---
change_id: web-blog-recipe-source
title: Web blog recipe source (S-02)
status: implemented
created: 2026-06-07
updated: 2026-06-12
archived_at: null
---

## Notes

second recipe source — mama shares a web blog URL and sees the recipe through the same pipeline as S-01 (facebook_text); only the scraper differs. `web_blog` Firecrawl options add a 2s wait + blog excludeTags, with a main-content retry fallback (onlyMainContent: false) when blogspot/WordPress templates trip the heuristic and return < 200 chars of markdown. Shipped via feat/web-blog-recipe-source (ade984e detect + af31c00 shared-lib refactor), already on master; user-verified end-to-end on real blog URLs.
