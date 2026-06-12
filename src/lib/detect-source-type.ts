import { isYoutubeHost, normalizeHost } from '@/lib/youtube'

export function detectSourceType(url: string): 'facebook_text' | 'web_blog' | 'youtube' {
  try {
    const host = normalizeHost(new URL(url).hostname)
    if (host === 'facebook.com' || host === 'fb.watch' || host === 'fb.me') {
      return 'facebook_text'
    }
    if (isYoutubeHost(host)) {
      return 'youtube'
    }
  } catch {
    // malformed URL — treat as web_blog
  }
  return 'web_blog'
}
