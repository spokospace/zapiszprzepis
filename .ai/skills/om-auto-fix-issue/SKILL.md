# om-auto-fix-issue — repo-local extension

This repository has one GitHub account, `spokospace`, and its `CLAUDE.md` ("One account") lets a PR merge once the validation gate passes. So here the chain does not stop at `merge-queue`: it merges what it built and confirms the deploy.

- **Step 1: run from this repository.** A session started in another checkout does not load this repo's `CLAUDE.md`, and the merge rule is in it. Work in a worktree of this repo (`git worktree add ../zapiszprzepis-<n> origin/master`).
- **Step 9: reviews are `COMMENT` reviews.** GitHub blocks self-reviews, so the verdict sits in the review body and the pipeline label (`merge-queue` / `changes-requested`), as in `om-review-prs`.
- **Step 13, new: merge.** It runs after step 12 (lock released, report built), and only when all of these hold:
  1. Step 9 ended approvable: no blocker, no un-waivered major. The PR carries `merge-queue` and is not a draft.
  2. No `do-not-merge` / `blocked` label, no conflict. The PR does not need a manual production step first (a migration through the Management API, a secret to set). If it does, stop and ask the owner.
  3. The gate (`pnpm typecheck`, `pnpm lint`, `pnpm test`) passes on the PR head merged with the current `master`. If `master` moved since the last run, merge it into the branch (a merge commit, never a force push), re-run the gate and push.
  4. If the change is UI-facing (`needs-qa`): step 10's `om-auto-qa-pr` evidence is on the PR. The QA gate is off here (`qaGate: false`), so `needs-qa` is advisory, but the evidence must exist.

  Then run `om-approve-merge-pr {PR_NUMBER}` (its repo-local extension skips the self-approval). Afterwards:
  - Confirm `master` points at the squash commit.
  - Wait for the Workers Build of `master`, then run `pnpm smoke:prod` (`CLAUDE.md`, "Po każdym deployu"). Report "done" only after its `✓`.
  - If smoke fails, report it with its output. The fix is a Retry of the `master` build in Cloudflare, which only the owner can do.

  If any condition fails, stop at `merge-queue` and say which one in the report.
- **Report:** add `Merged: <sha>` and the smoke result, or the condition that stopped the merge.
