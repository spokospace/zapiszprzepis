import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, getSuabaseServiceRoleKey } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-redirect'
import { devLoginEmail } from '@/lib/dev-login'
import { GENDER_KNOWN_COOKIE } from '@/lib/first-login'

/**
 * Dev-only QA sign-in: GET /api/dev/login?as=full|free&next=/path
 *
 * Lets an agent verify signed-in screens on the local dev server without anyone
 * typing or sharing a password. The service-role client mints a magic-link
 * token for the configured QA account and the SSR client verifies it right
 * away, which writes the session cookies; the email is never sent. 404 unless
 * devLoginEmail() allows it (dev server + DEV_LOGIN_ENABLED=1 + the email set).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams, origin } = request.nextUrl
  const email = devLoginEmail(searchParams.get('as'))
  if (!email) {
    return new NextResponse(null, { status: 404 })
  }

  const admin = createClient(SUPABASE_URL, getSuabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message ?? 'no token' }, { status: 500 })
  }

  // GoTrue's generateLink silently signs up an unknown email, so a typo in
  // .env.local would create a stray production user. The QA accounts are
  // created in the dashboard with "Auto Confirm User", so an unconfirmed user
  // here is one this call just created: refuse instead of signing it in.
  if (!data.user.email_confirmed_at) {
    return NextResponse.json(
      { error: `${email} is not a confirmed account — check DEV_LOGIN_EMAIL_*; delete the user in the Supabase dashboard if it was just created` },
      { status: 409 },
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  })
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 })
  }

  const response = NextResponse.redirect(new URL(safeNext(searchParams.get('next'), origin), origin))
  // The QA accounts deliberately have no gender and must not be changed
  // (docs/dev-qa-login.md), so the one-time 3b detour for such accounts is
  // skipped for them, as if the choice were known — this route is dev-only.
  response.cookies.set(GENDER_KNOWN_COOKIE, data.user.id, { path: '/', httpOnly: true, sameSite: 'lax' })
  return response
}
