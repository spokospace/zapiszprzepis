import { expect, test as setup } from '@playwright/test'
import { mkdirSync, rmSync } from 'fs'
import path from 'path'
import { QA_ACCOUNTS, qaSessionFile } from './qa-session'

/**
 * Signs each dev QA account in once per run (docs/dev-qa-login.md) and saves its
 * session for the signed-in reflow checks: repeated magic-link logins for the same
 * email within a short time fail (500). No file = route disabled, those checks skip.
 */
for (const as of QA_ACCOUNTS) {
  setup(`dev QA login (${as})`, async ({ request }) => {
    const file = qaSessionFile(as)
    rmSync(file, { force: true })
    const res = await request.get(`/api/dev/login?as=${as}&next=/`, { maxRedirects: 0 })
    setup.skip(res.status() === 404, '/api/dev/login is disabled')
    expect(res.status(), `dev login as ${as}`).toBe(307)
    mkdirSync(path.dirname(file), { recursive: true })
    await request.storageState({ path: file })
  })
}
