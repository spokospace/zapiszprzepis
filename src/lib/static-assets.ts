// The Next.js build files a page references (`/_next/static/…`: CSS, JS
// chunks, fonts), read from its HTML — attributes and the inlined RSC payload
// alike. A Worker version whose code and static assets come from different
// builds serves HTML naming files that 404, and the site renders unstyled and
// crashes on ChunkLoadError (2026-10-22). scripts/smoke-prod-assets.ts checks
// every one of them.

const STATIC_PATH = /\/_next\/static\/[^\s"'`<>()\\]+/g

/** Unique `/_next/static/…` paths in the HTML, query strings dropped. */
export function staticAssetPaths(html: string): string[] {
  const paths = new Set<string>()
  for (const [match] of html.matchAll(STATIC_PATH)) paths.add(match.split('?')[0])
  return [...paths].sort()
}
