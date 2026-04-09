import { expect, test } from '@playwright/test'

test.describe('Sidebar', () => {
  test('should keep collapsed desktop navigation inside the sidebar bounds', async ({ context, page }) => {
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

    const sidebar = page.getByTestId('sidebar')
    const sidebarToggle = page.getByTestId('sidebar-toggle')
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' })
    const catalogLink = page.getByRole('link', { name: 'Catalog', exact: true })

    await sidebarToggle.click()

    await expect(sidebar).toHaveCSS('width', '56px')

    const sidebarBox = await sidebar.boundingBox()
    const dashboardLinkBox = await dashboardLink.boundingBox()
    const catalogLinkBox = await catalogLink.boundingBox()
    const sidebarToggleBox = await sidebarToggle.boundingBox()

    expect(sidebarBox).not.toBeNull()
    expect(dashboardLinkBox).not.toBeNull()
    expect(catalogLinkBox).not.toBeNull()
    expect(sidebarToggleBox).not.toBeNull()

    if (
      sidebarBox === null ||
      dashboardLinkBox === null ||
      catalogLinkBox === null ||
      sidebarToggleBox === null
    ) {
      throw new Error('Sidebar elements must have visible bounding boxes in collapsed desktop mode')
    }

    expect(dashboardLinkBox.x).toBeGreaterThanOrEqual(sidebarBox.x)

    expect(dashboardLinkBox.x + dashboardLinkBox.width).toBeLessThanOrEqual(
      sidebarBox.x + sidebarBox.width
    )

    expect(catalogLinkBox.x).toBeGreaterThanOrEqual(sidebarBox.x)

    expect(catalogLinkBox.x + catalogLinkBox.width).toBeLessThanOrEqual(
      sidebarBox.x + sidebarBox.width
    )

    expect(sidebarToggleBox.x).toBeGreaterThanOrEqual(sidebarBox.x)

    expect(sidebarToggleBox.x + sidebarToggleBox.width).toBeLessThanOrEqual(
      sidebarBox.x + sidebarBox.width
    )

    expect(Math.round(dashboardLinkBox.width)).toBe(40)
    expect(Math.round(dashboardLinkBox.height)).toBe(40)
    expect(Math.round(catalogLinkBox.width)).toBe(40)
    expect(Math.round(catalogLinkBox.height)).toBe(40)
    expect(Math.round(sidebarToggleBox.width)).toBe(40)
    expect(Math.round(sidebarToggleBox.height)).toBe(40)
  })
})
