import { test as setup } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')
mkdirSync(path.dirname(authFile), { recursive: true })

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL
  const password = process.env.TEST_PASSWORD
  if (!email || !password) throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.local')

  await page.goto('/login')
  await page.getByRole('tab', { name: 'Hasło' }).click()
  await page.locator('#email-pass').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Zaloguj się' }).click()
  await page.waitForURL('/recipes')

  await page.context().storageState({ path: authFile })
})
