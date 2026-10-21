import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: '.env.local' })

// E2E_PORT lets an agent worktree run its own dev server next to another session's.
const port = process.env.E2E_PORT ?? '3001'
const baseURL = `http://localhost:${port}`
const REFLOW = /reflow\.spec\.ts/
const PHONE = /(menu-drawer|system-font)\.spec\.ts/
const IMAGE_ALLOWLIST = /image-optimizer-allowlist\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testIgnore: [REFLOW, PHONE, IMAGE_ALLOWLIST],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Request-level allowlist checks: no browser UI, no sign-in (#307).
    {
      name: 'image-allowlist',
      testMatch: IMAGE_ALLOWLIST,
    },
    // Layout checks: no password sign-in, so no dependency on the setup project.
    {
      name: 'reflow-setup',
      testMatch: /reflow\.setup\.ts/,
    },
    {
      name: 'reflow',
      testMatch: REFLOW,
      use: { ...devices['Desktop Chrome'] },
      // Signs the dev QA accounts in once, for the signed-in screens.
      dependencies: ['reflow-setup'],
    },
    // Phone layout (#448): the MENU drawer, and every main screen at a large system
    // font. Each spec sets its own phone viewport; signed-in screens reuse the QA sessions.
    {
      name: 'phone',
      testMatch: PHONE,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['reflow-setup'],
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
