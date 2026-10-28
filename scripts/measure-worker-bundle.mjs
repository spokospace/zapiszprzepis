// Measures the Worker's upload size the way Cloudflare counts it, and fails when
// it is over budget.
//
// The free plan refuses a script whose gzipped size is over 3 MiB. A Workers
// build that fails at upload leaves production on the previous version (it
// happened once already, see the note in src/middleware.ts), so the admin panel
// work checks the figure before a PR instead of after the deploy.
//
// Usage (after `pnpm exec opennextjs-cloudflare build`):
//   node scripts/measure-worker-bundle.mjs            # print the figure, check the budget
//   node scripts/measure-worker-bundle.mjs --budget-kib 2900
//
// It runs `wrangler deploy --dry-run`, which bundles exactly what a deploy would
// upload and prints "Total Upload: X KiB / gzip: Y KiB", and reads Y.
//
// Windows cannot run the OpenNext build (it creates symlinks and fails with
// EPERM without developer mode); run both steps in WSL or on Linux.
//
// Baseline before the admin panel (master at 7511317, 2026-10-28): 10852 KiB raw,
// 2320 KiB gzipped, 752 KiB below the limit. Each admin phase re-measures and a
// regression past the budget blocks its PR.
import { spawnSync } from 'node:child_process'

// The hard limit is 3 MiB (3072 KiB); the default budget keeps ~5 % headroom so a
// small dependency bump does not turn the next unrelated deploy red.
const HARD_LIMIT_KIB = 3072
const DEFAULT_BUDGET_KIB = 2900

const argIndex = process.argv.indexOf('--budget-kib')
const budgetKib = argIndex === -1 ? DEFAULT_BUDGET_KIB : Number(process.argv[argIndex + 1])
if (!Number.isFinite(budgetKib) || budgetKib <= 0 || budgetKib > HARD_LIMIT_KIB) {
  console.error(`measure-worker-bundle — --budget-kib must be a number up to ${HARD_LIMIT_KIB}.`)
  process.exit(2)
}

const run = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run', '--outdir', '.wrangler/bundle-check'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
})
const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`

if (run.status !== 0) {
  console.error(output.trim())
  console.error('measure-worker-bundle — wrangler dry run failed; run the OpenNext build first.')
  process.exit(1)
}

const match = output.match(/Total Upload:\s*([\d.,]+)\s*KiB\s*\/\s*gzip:\s*([\d.,]+)\s*KiB/i)
if (!match) {
  console.error(output.trim())
  console.error('measure-worker-bundle — could not find the "Total Upload … gzip" line in the wrangler output.')
  process.exit(1)
}

const rawKib = Number(match[1].replace(/,/g, ''))
const gzipKib = Number(match[2].replace(/,/g, ''))
const headroom = HARD_LIMIT_KIB - gzipKib

console.log(`Worker upload: ${rawKib.toFixed(0)} KiB raw, ${gzipKib.toFixed(0)} KiB gzipped`)
console.log(`Free-plan limit ${HARD_LIMIT_KIB} KiB, budget ${budgetKib} KiB, headroom to the limit ${headroom.toFixed(0)} KiB`)

if (gzipKib > budgetKib) {
  console.error(`measure-worker-bundle — over budget by ${(gzipKib - budgetKib).toFixed(0)} KiB.`)
  process.exit(1)
}
