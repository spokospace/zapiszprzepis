import { type NextRequest, NextResponse } from 'next/server'
import { triggerRecipeExtraction } from './actions'

/**
 * Web Share Target API endpoint
 *
 * Browser calls this when user selects "Share with ZapiszPrzepis" from system menu.
 * Form data includes:
 *   - url: string (required) — shared URL
 *   - title: string (optional) — page title
 *   - text: string (optional) — page description
 *
 * S-01: Store share intent in DB, trigger Trigger.dev extraction job, redirect to /recipes.
 * User must be logged in; if not, middleware redirects to /login (with redirect_to fallback).
 *
 * @see https://web.dev/web-share-target/
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const sharedUrl = formData.get('url') as string | null
    const sharedTitle = formData.get('title') as string | null
    const sharedText = formData.get('text') as string | null

    console.log('[share] Received share intent', {
      url: sharedUrl,
      title: sharedTitle,
      text: sharedText,
    })

    if (!sharedUrl) {
      console.warn('[share] Missing URL in share data')
      return NextResponse.redirect(new URL('/', request.url), { status: 303 })
    }

    // Trigger recipe extraction (server action handles auth check)
    const result = await triggerRecipeExtraction(
      sharedUrl,
      sharedTitle ?? undefined,
      sharedText ?? undefined
    )

    console.log('[share] Extraction triggered', result)

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

    // On other errors, redirect to home
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  }
}
