import { expect, test } from '@playwright/test'

test.describe('Dashboard page', () => {
  test('should restore the dashboard after guest login', async ({ context, page }) => {
    await context.route('**/api/auth/create-session**', async (route) => {
      await route.fulfill({
        status: 201,

        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }
      })
    })

    await page.goto('/')

    await expect(page).toHaveURL(/\/login\?redirectTo=(%2F|\/)$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/$/u)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByTestId('page-content-actions')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Welcome to Perd.' })).toBeVisible()

    await expect(
      page.getByText('Your dashboard will live here. The catalog browsing flow is still being rebuilt in staged iterations.')
    ).toBeVisible()
  })
})
