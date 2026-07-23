import { expect, test } from '../fixtures/global.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

const itemSummary = {
  id: itemId,
  name: 'PocketRocket Deluxe',
  brand: {
    name: 'MSR',
    slug: 'msr'
  },
  category: {
    name: 'Stoves',
    slug: 'stoves'
  },
  properties: [{
    dataType: 'number',
    name: 'Weight',
    slug: 'weight',
    unit: 'g',
    value: 83
  }]
}

test.describe('Gear library item detail', () => {
  test('should keep the placeholder page to the item title only', async ({
    context,
    page
  }) => {
    let myGearRequestCount = 0

    await context.route('**/api/auth/create-session**', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
        }
      })
    })

    await context.route(/\/api\/equipment\/items(?:\?.*)?$/u, async (route) => {
      await route.fulfill({
        json: {
          items: [itemSummary],
          limit: 10,
          page: 1,
          total: 1
        }
      })
    })

    await context.route(
      new RegExp(`/api/equipment/items/${itemId}(?:\\?.*)?$`, 'u'),
      async (route) => {
        await route.fulfill({
          json: {
            ...itemSummary,
            brand: { id: 1, ...itemSummary.brand },
            category: { id: 2, ...itemSummary.category },
            createdAt: '2026-04-01T09:00:00.000Z'
          }
        })
      }
    )

    await context.route('**/api/equipment/categories**', async (route) => {
      await route.fulfill({ json: [] })
    })

    await context.route('**/api/equipment/brands**', async (route) => {
      await route.fulfill({ json: [] })
    })

    await context.route('**/api/user/gear**', async (route) => {
      myGearRequestCount += 1
      await route.fulfill({ json: [] })
    })

    await page.goto('/login?redirectTo=/gear-library')
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page.getByRole('button', {
      name: `Add to My gear ${itemSummary.name}`
    })).toBeVisible()

    const catalogMyGearRequestCount = myGearRequestCount

    await page.getByRole('link', { name: itemSummary.name }).click()

    await expect(page).toHaveURL(new RegExp(`/gear-library/${itemId}`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: itemSummary.name })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to gear library' })).toHaveCount(0)
    await expect(page.getByText('83 g')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Save to my gear' })).toHaveCount(0)

    expect(myGearRequestCount).toBe(catalogMyGearRequestCount)
  })
})
