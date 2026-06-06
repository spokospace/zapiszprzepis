import { type NextRequest, NextResponse } from 'next/server'

/**
 * Web Share Target API endpoint
 *
 * Browser calls this when user selects "Share with ZapiszPrzepis" from system menu.
 * Form data includes:
 *   - url: string (required) — shared URL
 *   - title: string (optional) — page title
 *   - text: string (optional) — page description
 *
 * Returns 303 redirect to home (app opens) + triggers Trigger.dev job (S-01).
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
      // Web Share Target spec: malformed requests should redirect home, not error
      console.warn('[share] Missing URL in share data')
      return NextResponse.redirect(new URL('/', request.url), { status: 303 })
    }

    // Phase 2: Accept share intent, redirect to home
    // Phase 3 / S-01: Store in session/DB, trigger Trigger.dev job, show receipt

    // Redirect back to home with success (per spec: 303 See Other)
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  } catch (error) {
    console.error('[share] Unhandled error:', error)
    return NextResponse.redirect(new URL('/', request.url), { status: 303 })
  }
}
