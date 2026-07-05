import type { SupabaseClient } from '@supabase/supabase-js'

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000

export async function archiveImage(
  supabase: SupabaseClient,
  userId: string,
  recipeId: number,
  externalUrl: string,
): Promise<string | null> {
  try {
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
