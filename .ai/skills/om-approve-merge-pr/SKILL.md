# om-approve-merge-pr — repo-local extension

This repository has one GitHub account, `spokospace`. It authors every PR and it is also the reviewer. See "One account" in `CLAUDE.md`.

- **Step 3: skip the approving review.** GitHub refuses to let an author approve their own PR. Don't ask whether to go straight to merge: post a comment naming the merge reason ("merged on green tests without manual QA", per `CLAUDE.md`) and continue to step 4.
- **Step 4 and Rules, "required checks green": the local gate and the `CI` check.** `master` has no branch protection and no required checks on GitHub, so this skill enforces them. Merge only when both hold:
  - `pnpm typecheck`, `pnpm lint` and `pnpm test` pass on the PR head merged with the current `master`. A run whose output is in this session counts; otherwise run it.
  - The `CI` workflow (`.github/workflows/ci.yml`) has a completed, successful run for the PR's current head SHA, with both jobs green: the gate, and the Worker build with its size check. A red, cancelled or still-running `CI` run is a blocker. So is a missing one: the workflow runs on every `pull_request` event, so no run means it did not trigger. Push or re-run it, don't merge around it.
  Workers Builds runs only on `master`, so `CI` is the only check a PR has.
- **Merge pinned to the head that was tested:** `gh api -X PUT repos/spokospace/zapiszprzepis/pulls/<n>/merge -f merge_method=squash -f sha=<tested head>`. Then check that `master` points at the returned sha.
- **After merging:** confirm the `master` Workers Build, then run `pnpm smoke:prod` (`CLAUDE.md`).
- Everything else stands: drafts, conflicts, `do-not-merge`, `blocked`, an active `qa` label, and a PR that needs a manual production step first are never merged.
