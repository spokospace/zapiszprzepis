import { type NextRequest, NextResponse } from 'next/server'
import { triggerRecipeExtraction } from './actions'
import { addRecipeErrorPath, recipePath } from '@/lib/routes'
import { NO_FULL_ACCESS } from '@/lib/full-access'
import { EXTRACTION_RATE_LIMITED } from '@/lib/extraction-rate-limit'
import { extractFirstUrl } from '@/lib/extract-url'

/**
 * Web Share Target API endpoint
 *
 * Browser calls this when user selects "Share with Zapisz Przepis" from system menu.
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
 * POST /share is allowed through the proxy without auth; triggerRecipeExtraction
 * does the real auth check and throws 'Not authenticated' if there's no session.
 *
 * @see https://web.dev/web-share-target/
 */

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const urlField = formData.get('url') as string | null
    const sharedTitle = formData.get('title') as string | null
    const sharedText = formData.get('text') as string | null

    // Prefer the dedicated url field; fall back to a URL embedded in text/title.
    const sharedUrl = extractFirstUrl(urlField, sharedText, sharedTitle)

    console.log('[share] Received share intent', {
      urlField,
      title: sharedTitle,
      text: sharedText,
      resolvedUrl: sharedUrl,
    })

    if (!sharedUrl) {
      console.warn('[share] No URL found in url/text/title')
      // Visible feedback instead of a silent bounce to home.
      return NextResponse.redirect(new URL(addRecipeErrorPath('invalid_url'), request.url), { status: 303 })
    }

    // Trigger recipe extraction (server action handles auth check)
    const result = await triggerRecipeExtraction(
      sharedUrl,
      sharedTitle ?? undefined,
      sharedText ?? undefined
    )

    console.log('[share] Extraction triggered', result)

    if ('duplicate' in result && result.duplicate === 'completed') {
      return NextResponse.redirect(new URL(`${recipePath(result.slug)}?duplicate=1`, request.url), { status: 303 })
    }
    if ('duplicate' in result && result.duplicate === 'pending') {
      return NextResponse.redirect(new URL('/recipes?duplicate=pending', request.url), { status: 303 })
    }
    if ('duplicate' in result && result.duplicate === 'in_favorites') {
      return NextResponse.redirect(new URL(`${recipePath(result.slug)}?in_favorites=1`, request.url), { status: 303 })
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

    // Signed in but without full access (E01-S11): /dodaj shows the code gate (E01-S10).
    if (errorMsg === NO_FULL_ACCESS) {
      return NextResponse.redirect(new URL(addRecipeErrorPath('no_access'), request.url), { status: 303 })
    }

    // Over the per-account extraction cap (E02-S11-T04): /dodaj asks to try later.
    if (errorMsg === EXTRACTION_RATE_LIMITED) {
      return NextResponse.redirect(new URL(addRecipeErrorPath('rate_limited'), request.url), { status: 303 })
    }

    // On other errors, surface a recoverable error next to the add form.
    return NextResponse.redirect(new URL(addRecipeErrorPath('server'), request.url), { status: 303 })
  }
}
