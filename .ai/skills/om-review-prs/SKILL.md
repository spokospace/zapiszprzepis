# om-review-prs — repo-local extension

This repository has one GitHub account, `spokospace`. It authors every PR, Claude sessions included, and it is also `$CURRENT_USER`. See "One account" in `CLAUDE.md`.

- Step 2: **drop the "author is not `$CURRENT_USER`" filter.** A PR authored by `spokospace` is eligible for review. Every other filter stays as written: drafts, `do-not-merge` / `blocked`, `in-progress`, and foreign assignees.
- Step 2: `reviewDecision` never changes here, because GitHub blocks self-reviews. Treat a PR as already reviewed when `om-auto-review-pr` has posted a review (comment-type) on its current head commit. Re-review it only when it has newer commits.
- Step 5: each review is posted as a `COMMENT` review, and the pipeline label carries the verdict.
