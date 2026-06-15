---
change_id: test-pure-pipeline-units
title: Test pure pipeline units
status: implementing
created: 2026-06-15
updated: 2026-06-16
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

This change implements §3 Phase 1 of `context/foundation/test-plan.md`: configure
vitest and unit-test the cheap, high-signal pure functions of the extraction
pipeline. Covers Risk 2 (junk passes the gate), Risk 4 (ingredient mis-parse),
and Risk 5 (wrong source/id detection).
