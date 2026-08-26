import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

/* oxlint-disable vitest/no-conditional-in-test -- Playwright route handlers branch across sequential mocked responses. */
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const publishedItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2'
const submissionsPath = '/api/user/item-submissions'
const photoSubmissionsPath = '/api/user/photo-submissions'

async function authenticate(context: BrowserContext, page: Page, target: string) {
  await context.route((url) => url.pathname === '/api/oauth/twitch', async (route) => {
    await route.fulfill({
      json: {
        isAdmin: false,
        isGuest: false,
        userId
      }
    })
  })

  const state = encodeURIComponent(target)

  await page.goto(`/auth/twitch?code=twitch-code&state=${state}`)
  await expect.poll(() => new globalThis.URL(page.url()).pathname).toBe(target)
}

function createSubmissions() {
  const baseItem = {
    brand: {
      id: 10,
      name: 'MSR'
    },

    category: {
      id: 2,
      name: 'Stoves'
    },

    createdAt: '2026-08-01T12:00:00.000Z',

    properties: [{
      name: 'Weight',
      propertyId: 21,
      unit: 'g',
      value: '83.5'
    }],

    rejectionReason: null,
    updatedAt: '2026-08-02T12:00:00.000Z'
  }

  return [{
    ...baseItem,
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d1',
    name: 'Pending stove',
    status: 'pending'
  }, {
    ...baseItem,
    id: publishedItemId,
    name: 'Published corrected stove',

    properties: [{
      name: 'Piezo ignition',
      propertyId: 22,
      unit: null,
      value: false
    }],

    status: 'approved'
  }, {
    ...baseItem,
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d3',
    name: 'Rejected corrected stove',
    rejectionReason: 'Duplicate catalog item',
    status: 'rejected'
  }]
}

test.describe('Account gear submissions', () => {
  test('should navigate from Account and show final data for every status', async ({ context, page }) => {
    const responseGate = createDeferred()

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      await responseGate.promise
      await route.fulfill({ json: { items: createSubmissions() } })
    })
    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      await route.fulfill({
        json: {
          items: [],
          nextPage: null
        }
      })
    })
    await authenticate(context, page, '/account')

    const submissionsLink = page.getByRole('link', { name: /My contributions/u })

    await expect(submissionsLink).toBeVisible()
    await submissionsLink.click()
    await expect(page.getByText('Loading My contributions')).toBeVisible()
    responseGate.resolve()

    await expect(page).toHaveURL(/\/account\/submissions$/u)
    await expect(page.getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Published corrected stove' })).toHaveAttribute(
      'href',
      `/gear-library/${publishedItemId}`
    )
    await expect(page.getByRole('link', { name: 'Pending stove' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Rejected corrected stove' })).toHaveCount(0)
    await expect(page.getByText('Piezo ignition')).toBeVisible()
    await expect(page.getByText('No', { exact: true })).toBeVisible()
    await expect(page.getByText('83.5 g').first()).toBeVisible()
    await expect(page.getByText('Duplicate catalog item')).toBeVisible()
  })

  test('should retry a failed request and show the empty state', async ({ context, page }) => {
    let shouldSucceed = false

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      if (shouldSucceed) {
        await route.fulfill({ json: { items: [] } })

        return
      }

      await route.fulfill({
        json: { message: 'Temporary failure' },
        status: 500
      })
    })
    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      await route.fulfill({
        json: {
          items: [],
          nextPage: null
        }
      })
    })
    await authenticate(context, page, '/account/submissions')
    await expect(page.getByText('My contributions unavailable.')).toBeVisible()
    shouldSucceed = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('No contributions yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Submit gear' })).toHaveAttribute(
      'href',
      '/gear-library/new'
    )
  })

  test('should keep photo loading and error states retryable independently', async ({ context, page }) => {
    const firstPhotoResponseGate = createDeferred()
    let photoRequestCount = 0
    let shouldPhotoRequestSucceed = false

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      await route.fulfill({ json: { items: [] } })
    })
    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      photoRequestCount += 1

      if (photoRequestCount === 1) {
        await firstPhotoResponseGate.promise
      }

      if (shouldPhotoRequestSucceed === false) {
        await route.fulfill({
          status: 500,
          json: { message: 'Temporary photo failure' }
        })

        return
      }

      await route.fulfill({
        json: {
          nextPage: null,

          items: [{
            createdAt: '2026-08-10T12:00:00.000Z',
            filename: 'PocketRocket camp.webp',
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',

            item: {
              id: publishedItemId,
              name: 'Published corrected stove'
            },

            sourceType: 'own',
            sourceUrl: null,
            status: 'pending',
            updatedAt: '2026-08-10T12:00:00.000Z'
          }]
        }
      })
    })
    await authenticate(context, page, '/account/submissions')
    await expect(page.getByText('Loading My contributions')).toBeVisible()
    firstPhotoResponseGate.resolve()
    await expect(page.getByText('My contributions unavailable.')).toBeVisible()

    const failedPhotoRequestCount = photoRequestCount

    shouldPhotoRequestSucceed = true
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('heading', { name: 'Photo submissions' })).toBeVisible()
    await expect(page.getByText('PocketRocket camp.webp')).toBeVisible()
    await expect(page.getByText('Own photo')).toBeVisible()
    await expect.poll(() => photoRequestCount).toBeGreaterThan(failedPhotoRequestCount)
  })

  test('should retry and deduplicate paginated photo submissions', async ({ context, page }) => {
    const firstPhoto = {
      createdAt: '2026-08-10T12:00:00.000Z',
      filename: 'PocketRocket first.webp',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',

      item: {
        id: publishedItemId,
        name: 'Published corrected stove'
      },

      sourceType: 'own',
      sourceUrl: null,
      status: 'pending',
      updatedAt: '2026-08-10T12:00:00.000Z'
    } as const

    const secondPhoto = {
      ...firstPhoto,
      filename: 'PocketRocket second.webp',
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
    } as const

    let pageTwoRequestCount = 0

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      await route.fulfill({ json: { items: [] } })
    })
    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      const pageNumber = new globalThis.URL(route.request().url()).searchParams.get('page')

      if (pageNumber === '1') {
        await route.fulfill({
          json: {
            items: [firstPhoto],
            nextPage: 2
          }
        })

        return
      }

      pageTwoRequestCount += 1

      if (pageTwoRequestCount === 1) {
        await route.fulfill({
          status: 500,
          json: { message: 'Temporary pagination failure' }
        })

        return
      }

      await route.fulfill({
        json: {
          items: [firstPhoto, secondPhoto],
          nextPage: null
        }
      })
    })
    await authenticate(context, page, '/account/submissions')

    const loadMoreButton = page.getByRole('button', { name: 'Load more photo submissions' })

    await expect(page.getByText(firstPhoto.filename)).toBeVisible()
    await loadMoreButton.click()
    await expect(page.getByRole('alert')).toHaveText(
      'Could not load more photo submissions. Try again.'
    )
    await loadMoreButton.click()
    await expect(page.getByText(firstPhoto.filename)).toHaveCount(1)
    await expect(page.getByText(secondPhoto.filename)).toBeVisible()
    await expect(loadMoreButton).toHaveCount(0)

    const paginationStatus = page.getByRole('status')

    await expect(paginationStatus).toHaveText('All photo submissions are loaded.')
    await expect(paginationStatus).toBeFocused()
  })
})
