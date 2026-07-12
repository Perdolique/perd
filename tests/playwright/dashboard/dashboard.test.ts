import { expect, test } from '../fixtures/global.fixtures.ts'

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

    await expect(page).toHaveURL(/\/login\?redirectTo=(?<redirectTo>%2F|\/)$/u)

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/$/u)
    const pageContent = page.getByTestId('page-content')

    await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()

    const packingListsLink = pageContent.getByRole('link', { name: 'Packing lists Plan and check off gear' })
    const gearLibraryLink = pageContent.getByRole('link', { name: 'Gear library', exact: true })
    const myGearLink = pageContent.getByRole('link', { name: 'My gear', exact: true })

    await expect(packingListsLink).toBeVisible()
    await expect(packingListsLink).toHaveAttribute('href', '/packing-lists')
    await expect(gearLibraryLink).toBeVisible()
    await expect(gearLibraryLink).toHaveAttribute('href', '/gear-library')
    await expect(myGearLink).toBeVisible()
    await expect(myGearLink).toHaveAttribute('href', '/my-gear')
  })
})
