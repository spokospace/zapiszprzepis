import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Refreshes src/lib/recipe-blog-domains.json from the blog directory of
// aDupaRośnie, a Polish recipe aggregator. Its blogi.html lists every blog it
// aggregates on one page, each as a link of the form `./blogi,<domain>.html`,
// so the domain is read straight from the href. Run, review the diff, commit.

const SOURCE_URL = 'https://aduparosnie.pl/blogi.html'
const OUTPUT = resolve(import.meta.dirname, '../src/lib/recipe-blog-domains.json')

async function main(): Promise<void> {
  const res = await fetch(SOURCE_URL, { headers: { 'user-agent': 'Mozilla/5.0' } })
  if (!res.ok) {
    console.error(`✗ ${SOURCE_URL} returned ${res.status}`)
    process.exit(1)
  }
  const html = await res.text()

  const domains = new Set<string>()
  for (const [, blog] of html.matchAll(/href="\.\/blogi,([^"]+)\.html"/g)) {
    // Some entries carry a path ("x.blogspot.com/search/label/przepisy"). Exa
    // would read it as a path prefix and drop the blog's posts, which live
    // elsewhere on the host — so keep the hostname only.
    const host = blog.split('/')[0].toLowerCase().replace(/^www\./, '')
    domains.add(host)
  }
  // A layout change would silently empty the list and the search filter with it.
  if (domains.size < 100) {
    console.error(`✗ Only ${domains.size} domains found — the page layout probably changed`)
    process.exit(1)
  }

  const sorted = [...domains].sort()
  writeFileSync(OUTPUT, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`✓ ${sorted.length} domains → ${OUTPUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
