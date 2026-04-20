import { expect, test, type BrowserContext } from '@playwright/test'

async function mockGuestLogin(context: BrowserContext) {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
      }
    })
  })
}

async function mockCatalogReads(context: BrowserContext) {
  await context.route('**/api/equipment/items**', async (route) => {
    await route.fulfill({
      json: {
        items: [],
        limit: 20,
        page: 1,
        total: 0
      }
    })
  })
}

async function mockLogout(context: BrowserContext) {
  await context.route('**/api/auth/logout**', async (route) => {
    await route.fulfill({
      status: 204,
      body: ''
    })
  })
}

test.describe('Shell navigation', () => {
  test('should show the desktop sidebar, highlight the active route, and allow logout', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockCatalogReads(context)
    await mockLogout(context)

    await page.goto('/')

    await expect(page).toHaveURL(/\/login\?redirectTo=(%2F|\/)$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/$/u)

    const sidebar = page.getByTestId('shell-sidebar')

    await expect(sidebar).toBeVisible()
    await expect(page.getByTestId('shell-topbar')).toBeHidden()
    await expect(page.getByTestId('shell-dock')).toBeHidden()

    const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard' })
    const catalogLink = sidebar.getByRole('link', { name: 'Catalog' })
    const gearLink = sidebar.getByRole('link', { name: 'Gear' })
    const accountLink = sidebar.getByRole('link', { name: 'Account' })

    await expect(dashboardLink).toHaveClass(/active/u)
    await expect(catalogLink).toBeVisible()
    await expect(gearLink).toBeVisible()
    await expect(accountLink).toBeVisible()

    await catalogLink.click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(catalogLink).toHaveClass(/active/u)

    await accountLink.click()

    await expect(page).toHaveURL(/\/account$/u)
    await expect(accountLink).toHaveClass(/active/u)

    await sidebar.getByRole('button', { name: 'Log out' }).click()

    await expect(page).toHaveURL(/\/login$/u)
  })

  test('should expose the mobile top bar and dock navigation', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockCatalogReads(context)
    await mockLogout(context)

    await page.setViewportSize({
      width: 390,
      height: 844
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Guest' }).click()

    const topbar = page.getByTestId('shell-topbar')
    const dock = page.getByTestId('shell-dock')

    await expect(topbar).toBeVisible()
    await expect(dock).toBeVisible()
    await expect(page.getByTestId('shell-sidebar')).toBeHidden()

    const dockCatalogLink = dock.getByRole('link', { name: 'Catalog' })
    const dockAccountLink = dock.getByRole('link', { name: 'Account' })

    await dockCatalogLink.click()

    await expect(page).toHaveURL(/\/catalog$/u)
    await expect(dockCatalogLink).toHaveClass(/active/u)

    await dockAccountLink.click()

    await expect(page).toHaveURL(/\/account$/u)
    await expect(dockAccountLink).toHaveClass(/active/u)

    await topbar.getByRole('button', { name: 'Log out' }).click()

    await expect(page).toHaveURL(/\/login$/u)
  })
})
