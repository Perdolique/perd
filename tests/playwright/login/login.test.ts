import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('should display the login heading and auth buttons', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByText('Your Adventure Hub')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guest' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeVisible()
  })

  test('should return to the api document after guest login', async ({ page }) => {
    await page.goto('/api/equipment/brands')

    await expect(page).toHaveURL(/\/login\?redirectTo=\/api\/equipment\/brands$/)

    await page.route('**/api/auth/create-session', async (route) => {
      await route.fulfill({
        status: 201,

        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }
      })
    })

    await page.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/)
    await expect(page.locator('body')).toHaveText('[]')
  })

  test('should restore api redirects after the twitch callback', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      await route.fulfill({
        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          isAdmin: false
        }
      })
    })

    await page.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.goto('/auth/twitch?code=oauth-code&state=%2Fapi%2Fequipment%2Fbrands')

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/)
    await expect(page.locator('body')).toHaveText('[]')
  })
})
