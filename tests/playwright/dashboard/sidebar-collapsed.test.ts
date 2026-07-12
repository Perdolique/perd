import type { BrowserContext } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

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

async function mockGearLibraryReads(context: BrowserContext) {
  await context.route('**/api/equipment/categories**', async (route) => {
    await route.fulfill({
      json: []
    })
  })

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

async function mockPackingListReads(context: BrowserContext) {
  await context.route('**/api/user/packing-lists**', async (route) => {
    await route.fulfill({
      json: []
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
  test('should show the desktop sidebar, highlight the active route, and allow profile logout', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockGearLibraryReads(context)
    await mockLogout(context)

    await page.goto('/')

    await expect(page).toHaveURL(/\/login\?redirectTo=(?<redirectTo>%2F|\/)$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/$/u)

    const sidebar = page.getByTestId('shell-sidebar')

    await expect(sidebar).toBeVisible()
    await expect(page.getByTestId('shell-topbar')).toBeHidden()
    await expect(page.getByTestId('shell-dock')).toBeHidden()

    const homeLink = sidebar.getByRole('link', { name: 'Home' })
    const gearLibraryLink = sidebar.getByRole('link', { name: 'Gear library' })
    const myGearLink = sidebar.getByRole('link', { name: 'My gear' })
    const packingListsLink = sidebar.getByRole('link', { name: 'Packing lists' })
    const accountLink = sidebar.getByRole('link', { name: 'Profile' })

    await expect(homeLink).toHaveClass(/active/u)
    await expect(gearLibraryLink).toBeVisible()
    await expect(myGearLink).toBeVisible()
    await expect(packingListsLink).toBeVisible()
    await expect(accountLink).toBeVisible()

    await gearLibraryLink.click()

    await expect(page).toHaveURL(/\/gear-library$/u)
    await expect(gearLibraryLink).toHaveClass(/active/u)

    await accountLink.click()

    await expect(page).toHaveURL(/\/account$/u)
    await expect(accountLink).toHaveClass(/active/u)
    await expect(sidebar.getByRole('button', { name: 'Log out' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Log out' }).click()

    await expect(page).toHaveURL(/\/login$/u)
  })

  test('should expose mobile dock navigation without the top bar', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockGearLibraryReads(context)
    await mockPackingListReads(context)

    await page.setViewportSize({
      width: 390,
      height: 844
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Guest' }).click()

    const dock = page.getByTestId('shell-dock')

    await expect(page.getByTestId('shell-topbar')).toBeHidden()
    await expect(dock).toBeVisible()
    await expect(page.getByTestId('shell-sidebar')).toBeHidden()

    const dockListsLink = dock.getByRole('link', { name: 'Packing lists' })
    const dockProfileLink = dock.getByRole('link', { name: 'Profile' })

    await dockListsLink.click()

    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(dockListsLink).toHaveClass(/active/u)

    await dockProfileLink.click()

    await expect(page).toHaveURL(/\/account$/u)
    await expect(dockProfileLink).toHaveClass(/active/u)
  })
})
