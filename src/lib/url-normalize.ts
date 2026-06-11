export function normalizeUrl(raw: string): string {
  const url = new URL(raw)

  let pathname = url.pathname
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1)
  }

  return `${url.protocol}//${url.host}${pathname}${url.search}`
}
