import { test, expect } from '@playwright/test'

test.describe('Add recipe form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/recipes')
  })

  test('shows error when submitted empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Dodaj przepis' }).click()
    await expect(page.locator('p[role="alert"]')).toContainText('Wklej adres URL przepisu.')
  })

  test('shows error for invalid URL', async ({ page }) => {
    // Disable browser-native type=url validation so the Server Action can respond
    await page.locator('form').evaluate((form: HTMLFormElement) => { form.noValidate = true })
    await page.getByLabel('URL przepisu').fill('to-nie-jest-url')
    await page.getByRole('button', { name: 'Dodaj przepis' }).click()
    await expect(page.locator('p[role="alert"]')).toContainText('To nie wygląda jak prawidłowy URL.')
  })

  test('accepts valid URL and shows success toast', async ({ page }) => {
    await page.getByLabel('URL przepisu').fill('https://example.com/przepis-testowy')
    await page.getByRole('button', { name: 'Dodaj przepis' }).click()
    await page.waitForURL('/recipes?shared=1')
    await expect(page.getByText('Przepis wysłany do przetwarzania')).toBeVisible()
  })
})
