// Runs after `next build`: opens recipes on the freshly built server and saves them in public/,
// which OpenNext copies to the Worker's static assets. /przepis/{slug} then finds
// przepis/{slug}.html and never starts the Worker. One recipe that fails stays on the Worker.
// recipe-files.json is a list of slugs, or "all" for every public recipe; [] serves every
// recipe and /szukaj from the Worker again.
//
// When the export as a whole fails (the recipe list cannot be read, or most recipes do not
// export), the build fails, so the last good version stays live. 2026-11-11: a build during a
// Supabase outage (402, quota) skipped the export and shipped a version without recipe files;
// the Worker could not render them either, so every recipe answered 404.
//
// Not generateStaticParams: on a static route a slug outside the list that reads the session
// answers 500. A saved page is the same stream a live one is: the skeleton from loading.tsx,
// then the content and the inline script that swaps it in, so it needs JavaScript like today.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = 3977
// 925 recipes took 34 s at 8 in parallel on a laptop; one at a time is about 4 minutes.
const PARALLEL = 8
// A build may run 20 minutes. Recipes left when this runs out stay on the Worker.
const TIME_LIMIT_MS = 10 * 60_000
const PAGE_SIZE = 1000
// One recipe that never exports must not cost 12 builds a day; an outage or the time limit must.
const COMPLETE_SHARE = 0.99
// Below this share the build fails instead of shipping most recipes without a file.
const MIN_SHARE = 0.9

// The status is sent before the page is rendered, so a page that failed half way is still a 200.
// The recipe's structured data is written only once the recipe has been read.
const isRecipePage = (html) => html.includes('"@type":"Recipe"') && html.includes('</html>')

export async function exportRecipeFiles(slugs, fetchPage, { root = process.cwd(), deadline = Infinity } = {}) {
  const to = join(root, 'public/przepis')
  rmSync(to, { recursive: true, force: true })
  const exported = []
  const queue = [...slugs]
  async function work() {
    while (queue.length > 0 && Date.now() < deadline) {
      const slug = queue.shift()
      const page = await fetchPage(slug).catch(() => null)
      if (page?.status !== 200 || !isRecipePage(page.html)) continue
      mkdirSync(to, { recursive: true })
      writeFileSync(join(to, `${slug}.html`), page.html)
      exported.push(slug)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, work))
  return exported
}

/**
 * /szukaj reads the query in the browser, so one file serves every search. A page that failed
 * leaves no file, and the Worker answers as before.
 */
export async function exportSearchPage(fetchPage, root = process.cwd()) {
  const file = join(root, 'public/szukaj.html')
  rmSync(file, { force: true })
  const page = await fetchPage().catch(() => null)
  if (page?.status !== 200 || !page.html.includes('Szukaj przepisu') || !page.html.includes('</html>')) return false
  writeFileSync(file, page.html)
  return true
}

/**
 * The home page reads neither the session nor the URL, so one file serves everyone. A page that
 * failed leaves no file, and the Worker answers as before. „Przepis dnia” is frozen in the file,
 * so the file records its day (see writeContentVersion) and the cron asks for a build after
 * Polish midnight.
 */
export async function exportHomePage(fetchPage, root = process.cwd()) {
  const file = join(root, 'public/index.html')
  rmSync(file, { force: true })
  const page = await fetchPage().catch(() => null)
  if (page?.status !== 200 || !page.html.includes('"@type":"WebSite"') || !page.html.includes('</html>')) return false
  writeFileSync(file, page.html)
  return true
}

/**
 * The category values, read from RECIPE_CATEGORIES in src/lib/recipe-categories.ts (this
 * script cannot import TypeScript); recipe-files.test.ts checks the two lists agree.
 */
export function recipeCategories(source = readFileSync('src/lib/recipe-categories.ts', 'utf8')) {
  const start = source.indexOf('export const RECIPE_CATEGORIES')
  // The list ends at the first line that is just `]` (the type has a `[]` of its own).
  const block = source.slice(start, source.indexOf('\n]', start))
  return [...block.matchAll(/value: '([a-z0-9-]+)'/g)].map((match) => match[1])
}

/**
 * Category lists hold every card of the category and filter `?tag=` / `?strona=` in the
 * browser, so one file serves every variant of the address (#739). The page marks itself
 * with `data-category-page="{category}"`, so a wrong or error page is never saved. A
 * category that failed leaves no file, and the Worker answers as before.
 */
export async function exportCategoryPages(categories, fetchPage, root = process.cwd()) {
  const to = join(root, 'public/przepisy')
  rmSync(to, { recursive: true, force: true })
  const saved = []
  for (const category of categories) {
    const page = await fetchPage(category).catch(() => null)
    if (page?.status !== 200 || !page.html.includes(`data-category-page="${category}"`) || !page.html.includes('</html>')) continue
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, `${category}.html`), page.html)
    saved.push(category)
  }
  return saved
}

/** The Europe/Warsaw civil day as YYYY-MM-DD; the same key as warsawDayKey in src/lib/recipe-of-the-day.ts. */
export const warsawDay = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

/** Every read the export makes lands here, and OpenNext uploads all of it to R2 on each deploy. */
export function clearDataCache(root = process.cwd()) {
  rmSync(join(root, '.next/cache/fetch-cache'), { recursive: true, force: true })
}

/** A short export saves no version, so the cron asks for another build, within its daily limit. */
export function versionToSave(version, exported, total) {
  return exported >= total * COMPLETE_SHARE ? version : null
}

/**
 * Why this export must fail the build, or null when it may ship. Only for "all": a short list
 * of slugs (a pilot, or [] to go back to the Worker) may export nothing.
 */
export function exportShortfall(listed, exported, total) {
  if (listed !== 'all') return null
  if (total === 0) return 'the database lists no public recipes'
  return exported >= total * MIN_SHARE ? null : `only ${exported} of ${total} recipes exported`
}

/**
 * Which content the saved pages hold. The Worker's cron compares it with the database. `day` is
 * the Warsaw day of the saved home page, or null when there is none: the cron then has no daily
 * rebuild to ask for.
 */
export function writeContentVersion(version, day = null, root = process.cwd()) {
  writeFileSync(join(root, 'public/recipe-files-version.json'), JSON.stringify({ version, day }))
}

function supabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync('.env.local')) process.loadEnvFile('.env.local')
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return { url: process.env.NEXT_PUBLIC_SUPABASE_URL, headers: { apikey: key, Authorization: `Bearer ${key}` } }
}

async function publicSlugs() {
  const { url, headers } = supabase()
  const slugs = []
  for (;;) {
    const query = `select=slug&order=id.asc&limit=${PAGE_SIZE}&offset=${slugs.length}`
    const response = await fetch(`${url}/rest/v1/public_recipes?${query}`, { headers })
    if (!response.ok) throw new Error(`recipe list: ${response.status}`)
    const rows = await response.json()
    slugs.push(...rows.map((row) => row.slug))
    if (rows.length < PAGE_SIZE) return slugs
  }
}

/** Read before the pages, so a change made during the export asks for one more build. */
async function contentVersion() {
  const { url, headers } = supabase()
  const response = await fetch(`${url}/rest/v1/rpc/recipe_content_version`, { method: 'POST', headers })
  return response.ok ? response.json() : null
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    const up = await fetch(`http://localhost:${PORT}/robots.txt`).catch(() => null)
    if (up) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('the server did not start')
}

async function main() {
  const listed = JSON.parse(readFileSync('scripts/recipe-files.json', 'utf8'))
  const version = await contentVersion().catch(() => null)
  const slugs = listed === 'all' ? await publicSlugs() : listed
  const day = warsawDay()
  if (listed === 'all' && slugs.length === 0) throw new Error(exportShortfall(listed, 0, 0))
  const { exported, home } = slugs.length === 0 ? await clearFiles() : await exportFromServer(slugs)
  const shortfall = exportShortfall(listed, exported.length, slugs.length)
  if (shortfall) throw new Error(shortfall)
  writeContentVersion(versionToSave(version, exported.length, slugs.length), home ? day : null)
  return exported
}

async function clearFiles() {
  await exportSearchPage(async () => null)
  await exportHomePage(async () => null)
  await exportCategoryPages([], async () => null)
  return { exported: await exportRecipeFiles([]), home: false }
}

async function exportFromServer(slugs) {
  // A build cache could bring back the last build's entries, with the old recipes in them.
  clearDataCache()
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { stdio: 'inherit' })
  try {
    await waitForServer()
    const open = async (path) => {
      const response = await fetch(`http://localhost:${PORT}${path}`, { redirect: 'manual' })
      return { status: response.status, html: await response.text() }
    }
    if (!(await exportSearchPage(() => open('/szukaj')))) console.error('[recipe-files] /szukaj stays on the Worker')
    const home = await exportHomePage(() => open('/'))
    if (!home) console.error('[recipe-files] / stays on the Worker')
    const categories = recipeCategories()
    const savedCategories = await exportCategoryPages(categories, (category) => open(`/przepisy/${category}`))
    const missed = categories.filter((category) => !savedCategories.includes(category))
    if (missed.length > 0) console.error(`[recipe-files] categories stay on the Worker: ${missed.join(', ')}`)
    const exported = await exportRecipeFiles(slugs, (slug) => open(`/przepis/${slug}`), { deadline: Date.now() + TIME_LIMIT_MS })
    return { exported, home }
  } finally {
    server.kill()
    clearDataCache()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.env.RECIPE_FILES_EXPORT === 'skip') {
    // Only for builds that are measured, never deployed (CI): no files, recipes stay on the Worker.
    console.log('[recipe-files] RECIPE_FILES_EXPORT=skip: no recipe files in this build')
    process.exit()
  }
  main()
    .then((exported) => console.log(`[recipe-files] ${exported.length} recipes exported as static files`))
    .catch((error) => {
      // Fails the build: Workers Builds then deploys nothing, and the last good version stays live.
      console.error('[recipe-files] export failed, stopping the build:', error.message)
      process.exitCode = 1
    })
    .finally(() => process.exit())
}
