import type { SupabaseClient } from '@supabase/supabase-js'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

// Private/loopback/cloud-metadata hostnames and prefixes that must never be
// fetched server-side. A content-controlled og:image could point here (SSRF).
const BLOCKED_HOSTS = new Set(['localhost', '169.254.169.254', 'metadata.google.internal'])

/**
 * Returns true when the URL resolves to a private, loopback, link-local, or
 * cloud-metadata address that must not be fetched from the server side.
 * Returns true on parse failure — an invalid URL should never be fetched.
 */
export function isPrivateUrl(url: string): boolean {
  let hostname: string
  try {
    hostname = new URL(url).hostname.toLowerCase()
  } catch {
    return true
  }
  if (BLOCKED_HOSTS.has(hostname)) return true
  // Strip IPv6 brackets: [::1] → ::1
  const h = hostname.replace(/^\[|\]$/g, '')
  if (h === '::1' || h === '0:0:0:0:0:0:0:1') return true
  // IPv4 private / loopback ranges
  if (
    h.startsWith('127.') ||
    h.startsWith('0.') ||
    h.startsWith('10.') ||
    h.startsWith('169.254.') ||
    h.startsWith('192.168.')
  ) return true
  // 172.16.0.0/12 → 172.16.x.x – 172.31.x.x
  const parts = h.split('.')
  if (parts.length === 4 && parts[0] === '172') {
    const second = Number(parts[1])
    if (second >= 16 && second <= 31) return true
  }
  return false
}

export async function archiveImage(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  externalUrl: string,
): Promise<string | null> {
  try {
    if (isPrivateUrl(externalUrl)) {
      console.warn(`[archiveImage] blocked private/metadata URL: ${externalUrl}`)
      return null
    }

    const response = await fetch(externalUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!response.ok) {
      console.warn(`[archiveImage] download ${response.status} for ${externalUrl}`)
      return null
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
    const ext = ALLOWED_MIME[contentType]
    if (!ext) {
      console.warn(`[archiveImage] unsupported MIME ${contentType} for ${externalUrl}`)
      return null
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      console.warn(`[archiveImage] too large ${contentLength}B for ${externalUrl}`)
      return null
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) {
      console.warn(`[archiveImage] too large after read ${bytes.byteLength}B for ${externalUrl}`)
      return null
    }

    const path = `${userId}/${recipeId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('recipe-images')
      .upload(path, bytes, { contentType, upsert: true })

    if (uploadError) {
      console.warn(`[archiveImage] upload failed: ${uploadError.message}`)
      return null
    }

    const { data: publicUrl } = supabase.storage.from('recipe-images').getPublicUrl(path)
    return publicUrl.publicUrl
  } catch (error) {
    console.warn(`[archiveImage] error: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

export function extractStoragePath(imageUrl: string): string | null {
  const match = imageUrl.match(/\/storage\/v1\/object\/public\/recipe-images\/(.+)$/)
  return match ? match[1] : null
}

const ATTR_RE = /\bdata-lazy-src=["']([^"']+)["']|\bdata-src=["']([^"']+)["']|\bsrc=["']([^"']+)["']/i
const SKIP_RE = /gravatar|avatar|\/logo/i

export function extractFirstImage(html: string): string | undefined {
  for (const tag of html.match(/<img\b[^>]+>/gi) ?? []) {
    const m = ATTR_RE.exec(tag)
    const url = m?.[1] ?? m?.[2] ?? m?.[3]
    if (url && !SKIP_RE.test(url)) return url
  }
}
