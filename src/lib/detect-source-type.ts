import { isYoutubeHost, normalizeHost } from '@/lib/youtube'
import { isFacebookUrl } from '@/lib/facebook'

export function detectSourceType(url: string): 'facebook_text' | 'web_blog' | 'youtube' {
  // Facebook host knowledge lives in facebook.ts, next to the fetcher that
  // depends on it — same arrangement as the YouTube hosts below.
  if (isFacebookUrl(url)) {
    return 'facebook_text'
  }
  try {
    const host = normalizeHost(new URL(url).hostname)
    if (isYoutubeHost(host)) {
      return 'youtube'
    }
  } catch {
    // malformed URL — treat as web_blog
  }
  return 'web_blog'
}
