import { expect, test } from '@playwright/test'

test.describe('Catalog placeholder', () => {
  test('should restore the catalog placeholder after guest login', async ({ context, page }) => {
    await context.route('**/api/auth/create-session**', async (route) => {
      await route.fulfill({
        status: 201,

        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }
      })
    })

    await page.goto('/catalog')

    await expect(page).toHaveURL(/\/login\?redirectTo=\/catalog$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(page.getByRole('heading', { name: 'Catalog', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Catalog', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Catalog is being rebuilt.' })).toBeVisible()

    await expect(
      page.getByText('This area is temporarily a placeholder while we rebuild the browsing flow in staged iterations on top of the existing read APIs.')
    ).toBeVisible()
  })
})
