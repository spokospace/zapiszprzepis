import { type NextRequest, NextResponse } from 'next/server'
import { triggerRecipeExtraction } from './actions'

/**
 * Web Share Target API endpoint
 *
 * Browser calls this when user selects "Share with ZapiszPrzepis" from system menu.
 * Form data includes:
 *   - url: string (optional) — shared URL
 *   - title: string (optional) — page title
 *   - text: string (optional) — page description / shared text
 *
 * IMPORTANT: on Android, Chrome (and many apps) deliver the shared link in the
 * `text` field, not `url` — sometimes wrapped in extra words ("Look at this
 * https://…"). Relying on `url` alone means the share silently does nothing.
 * So we fall back to extracting the first http(s) URL from `text`, then `title`.
 *
 * Store share intent in DB, trigger extraction, redirect to /recipes.
 * POST /share is allowed through middleware without auth; triggerRecipeExtraction
 * does the real auth check and throws 'Not authenticated' if there's no session.
 *
 * @see https://web.dev/web-share-target/
 */

// First http(s) URL found in any of the candidate strings, trimmed of trailing
// punctuation the sharing app may have appended.
function firstUrl(...candidates: (string | null)[]): string | null {
  for (const candidate of candidates) {
    const match = candidate?.match(/https?:\/\/[^\s<>"']+/i)
    if (match) return match[0].replace(/[)\].,;!?]+$/, '')
  }
  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const urlField = formData.get('url') as string | null
    const sharedTitle = formData.get('title') as string | null
    const sharedText = formData.get('text') as string | null

    // Prefer the dedicated url field; fall back to a URL embedded in text/title.
    const sharedUrl = firstUrl(urlField, sharedText, sharedTitle)

    console.log('[share] Received share intent', {
      urlField,
      title: sharedTitle,
      text: sharedText,
      resolvedUrl: sharedUrl,
    })

    if (!sharedUrl) {
      console.warn('[share] No URL found in url/text/title')
      // Visible feedback instead of a silent bounce to home.
      return NextResponse.redirect(new URL('/recipes?add_error=invalid_url', request.url), { status: 303 })
    }

    // Trigger recipe extraction (server action handles auth check)
    const result = await triggerRecipeExtraction(
      sharedUrl,
      sharedTitle ?? undefined,
      sharedText ?? undefined
    )

    console.log('[share] Extraction triggered', result)

    if ('duplicate' in result && result.duplicate === 'completed') {
      return NextResponse.redirect(new URL(`/recipes/${result.slug}?duplicate=1`, request.url), { status: 303 })
    }
    if ('duplicate' in result && result.duplicate === 'pending') {
      return NextResponse.redirect(new URL('/recipes?duplicate=pending', request.url), { status: 303 })
    }

    // Redirect to recipes list with shared flag (shows toast confirmation)
    const recipesUrl = new URL('/recipes?shared=1', request.url)
    return NextResponse.redirect(recipesUrl, { status: 303 })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[share] Error:', errorMsg)

    // If auth error, redirect to login with return URL
    if (errorMsg.includes('Not authenticated')) {
      return NextResponse.redirect(new URL('/login', request.url), { status: 303 })
    }

    // On other errors, surface a recoverable error on the recipes page.
    return NextResponse.redirect(new URL('/recipes?add_error=server', request.url), { status: 303 })
  }
}
