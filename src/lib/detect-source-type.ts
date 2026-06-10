export function detectSourceType(url: string): 'facebook_text' | 'web_blog' {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host === 'facebook.com' || host === 'fb.watch' || host === 'fb.me') {
      return 'facebook_text'
    }
  } catch {
    // malformed URL — treat as web_blog
  }
  return 'web_blog'
}
