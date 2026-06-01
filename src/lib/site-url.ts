import { headers } from 'next/headers'

export async function getSiteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const h = await headers()
  const host = h.get('host')
  const isLocal = !host || /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|::1|\[::1\]|.+\.local)/i.test(host)
  const protocol = h.get('x-forwarded-proto') ?? (isLocal ? 'http' : 'https')
  return `${protocol}://${host}`
}
