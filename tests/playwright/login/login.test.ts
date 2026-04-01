import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('should display the login heading and auth buttons', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText('Your Adventure Hub')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guest' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeVisible()
  })
})
