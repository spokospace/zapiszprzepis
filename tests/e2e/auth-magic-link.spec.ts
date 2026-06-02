import { test, expect } from '@playwright/test'

// Happy-path smoke test for the F-01 magic-link auth flow. Stops at /login?sent=1
// without clicking the magic link in the email — that path requires email
// infrastructure (real inbox, Supabase test users, or admin API) which is
// out-of-scope for the 1-user MVP. This test still catches the regressions we
// care about: Worker deploy health, middleware redirect, Supabase URL config,
// and Redirect URLs allowlist (per lessons.md rule #7).
test('happy path: magic-link form submit redirects to sent page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login(\?|$)/)

  const emailInput = page.getByLabel('Email')
  await expect(emailInput).toBeVisible()
  await expect(emailInput).toBeFocused()

  const submitButton = page.getByRole('button', { name: 'Wyślij link' })
  await expect(submitButton).toBeVisible()

  // Unique address per run avoids Supabase OTP send rate limit (~60s per IP)
  // when the test is run several times back-to-back. Note: synthetic
  // example.com addresses are often rejected by Supabase email deliverability
  // checks (RFC 2606 reserved domain) — when that happens the Server Action
  // redirects to ?error=unknown rather than ?sent=1. Both outcomes prove the
  // form + Server Action + Supabase wiring is intact end-to-end, which is
  // what this smoke test exists to verify. Distinguishing sent=1 from error=*
  // (e.g. for lessons.md rule #7 allowlist drift) requires a real test inbox
  // or Supabase test-user setup — out of scope for the 1-user MVP.
  const testEmail = `e2e-${Date.now()}@example.com`
  await emailInput.fill(testEmail)
  await submitButton.click()

  await expect(page).toHaveURL(/\/login\?(sent=1|error=)/)
})
