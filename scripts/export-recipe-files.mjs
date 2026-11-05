// Runs after `next build`: opens the pilot's recipes on the freshly built server and saves them
// in public/, which OpenNext copies to the Worker's static assets. /przepis/{slug} then finds
// przepis/{slug}.html and never starts the Worker. Any failure leaves that recipe on the Worker,
// so this never fails a build. Empty recipe-files.json to end the pilot.
//
// Not generateStaticParams: on a static route a slug outside the list that reads the session
// answers 500. A saved page is the same stream a live one is: the skeleton from loading.tsx,
// then the content and the inline script that swaps it in, so it needs JavaScript like today.
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = 3977

export async function exportRecipeFiles(slugs, fetchPage, root = process.cwd()) {
  const to = join(root, 'public/przepis')
  rmSync(to, { recursive: true, force: true })
  const exported = []
  for (const slug of slugs) {
    const page = await fetchPage(slug).catch(() => null)
    if (page?.status !== 200 || !page.html.includes('</html>')) continue
    mkdirSync(to, { recursive: true })
    writeFileSync(join(to, `${slug}.html`), page.html)
    exported.push(slug)
  }
  return exported
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
  const slugs = JSON.parse(readFileSync('scripts/recipe-files.json', 'utf8'))
  if (slugs.length === 0) return exportRecipeFiles([])
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], { stdio: 'inherit' })
  try {
    await waitForServer()
    return await exportRecipeFiles(slugs, async (slug) => {
      const response = await fetch(`http://localhost:${PORT}/przepis/${slug}`, { redirect: 'manual' })
      return { status: response.status, html: await response.text() }
    })
  } finally {
    server.kill()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((exported) => console.log(`[recipe-files] ${exported.length} recipes exported as static files`))
    .catch((error) => console.error('[recipe-files] skipped:', error.message))
    .finally(() => process.exit(0))
}
