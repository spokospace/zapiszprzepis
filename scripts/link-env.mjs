// Copies `.env.local` from the main git checkout into the current worktree.
//
// `.env.local` is gitignored, so `git worktree add` never brings it along and a
// fresh worktree starts without it — dev server, the dev QA login, the backfill
// scripts and `smoke:prod` then fail for lack of env. This restores it without a
// hardcoded path: the main checkout is derived from git, so the script works from
// any worktree on any machine.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// `--git-common-dir` points at the MAIN repo's `.git` (shared by every linked
// worktree); `--path-format=absolute` guarantees an absolute path to resolve from.
const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
  encoding: 'utf8',
}).trim()
const mainCheckout = dirname(commonDir)
const src = join(mainCheckout, '.env.local')
const dest = resolve('.env.local')

if (src === dest) {
  console.log('env:link — this is the main checkout; nothing to copy.')
  process.exit(0)
}
if (!existsSync(src)) {
  console.error(`env:link — no .env.local in the main checkout (${src}). Create it there first.`)
  process.exit(1)
}
copyFileSync(src, dest)
console.log(`env:link — copied .env.local from ${mainCheckout}`)
