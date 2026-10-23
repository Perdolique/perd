import type { BrowserContext, Page } from '@playwright/test'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { createDeferred, mockItemDetailApi, stoveItem } from '../fixtures/gear-library-entry-list.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'

/* oxlint-disable vitest/no-conditional-in-test -- Playwright route handlers branch across sequential mocked responses. */
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const publishedItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2'
const submissionsPath = '/api/user/item-submissions'
const photoSubmissionsPath = '/api/user/photo-submissions'

async function authenticate(context: BrowserContext, page: Page, target: string) {
  await mockAccountUser(context, {
    email: null,
    isAdmin: false,
    isGuest: false,
    isTwitchLinked: true,
    userId
  })

  await mockTwitchSignIn(context, page, {
    redirectTo: target,

    user: {
      email: null,
      isAdmin: false,
      isGuest: false,
      userId
    }
  })

  const targetUrl = new globalThis.URL(target, 'http://localhost')

  await expect.poll(() => new globalThis.URL(page.url()).pathname).toBe(targetUrl.pathname)
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
    await expect(page.locator('section').getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.locator('section').getByText('Published', { exact: true })).toBeVisible()
    await expect(page.locator('section').getByText('Rejected', { exact: true })).toBeVisible()

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
    await expect(page.getByRole('heading', { name: 'No contributions yet.' })).toBeVisible()

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

            rejectionReason: null,
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

      rejectionReason: null,
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

    const paginationStatus = page.getByRole('status').filter({ hasText: 'All photo submissions are loaded.' })

    await expect(paginationStatus).toHaveText('All photo submissions are loaded.')
    await expect(paginationStatus).toBeFocused()
  })

  test('should show every photo review status and the rejection reason', async ({ context, page }) => {
    const photoBase = {
      createdAt: '2026-08-10T12:00:00.000Z',
      filename: 'PocketRocket photo.webp',

      item: {
        id: publishedItemId,
        name: 'Published corrected stove'
      },

      rejectionReason: null,
      sourceType: 'own',
      sourceUrl: null,
      updatedAt: '2026-08-10T12:00:00.000Z'
    } as const

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      await route.fulfill({ json: { items: [] } })
    })

    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      await route.fulfill({
        json: {
          items: [{
            ...photoBase,
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d1',
            status: 'pending'
          }, {
            ...photoBase,
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2',
            status: 'approved'
          }, {
            ...photoBase,
            id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d3',
            rejectionReason: 'The product is not visible',
            status: 'rejected'
          }],

          nextPage: null
        }
      })
    })

    await authenticate(context, page, '/account/submissions')
    await expect(page.locator('section').getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.locator('section').getByText('Published', { exact: true })).toBeVisible()
    await expect(page.locator('section').getByText('Rejected', { exact: true })).toBeVisible()
    await expect(page.getByText('The product is not visible')).toBeVisible()
  })
})

const photoFixture = {
  createdAt: '2026-08-10T12:00:00.000Z',
  filename: 'Pending contribution.webp',
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',

  item: {
    id: publishedItemId,
    name: 'Published corrected stove'
  },

  rejectionReason: null,
  sourceType: 'own',
  sourceUrl: null,
  status: 'pending',
  updatedAt: '2026-08-10T12:00:00.000Z'
} as const

test.describe('Contribution filters', () => {
  test('should filter by status and type, preserve history, and clear on a narrow screen', async ({ context, page }) => {
    await page.setViewportSize({
      width: 360,
      height: 800
    })

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      const request = route.request()
      const requestAddress = request.url()
      const requestUrl = new globalThis.URL(requestAddress)
      const status = requestUrl.searchParams.get('status')
      const submissions = createSubmissions()
      const items = submissions.filter(item => status === null || item.status === status)

      await route.fulfill({ json: { items } })
    })

    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      const request = route.request()
      const requestAddress = request.url()
      const requestUrl = new globalThis.URL(requestAddress)
      const status = requestUrl.searchParams.get('status')
      const items = status === null || status === 'pending' ? [photoFixture] : []

      await route.fulfill({ json: {
        items,
        nextPage: null
      } })
    })

    await authenticate(context, page, '/account/submissions')

    const controls = page.getByRole('group', { name: 'Contribution filters' })
    const status = controls.getByRole('combobox', { name: /^Status/u })

    await test.step('Select status with the keyboard and show only photos', async () => {
      await status.focus()
      await status.press('ArrowDown')
      await status.press('ArrowDown')
      await status.press('Enter')
      await expect(page).toHaveURL(/status=pending/u)
      await expect(page.getByText(photoFixture.filename)).toBeVisible()
      await controls.getByRole('combobox', { name: /^Type/u }).click()

      await page.getByRole('option', {
        name: 'Photos',
        exact: true
      }).click()

      await expect(page).toHaveURL(/type=photos/u)
      await expect(page.getByRole('heading', { name: 'Item submissions' })).toHaveCount(0)
      await expect(page.getByText(photoFixture.filename)).toBeVisible()
    })

    await test.step('Restore filter history and the reload return target', async () => {
      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Item submissions' })).toBeVisible()
      await page.goForward()
      await expect(controls.getByRole('combobox', { name: /^Type/u })).toContainText('Photos')

      const filteredUrl = new globalThis.URL(page.url())

      await page.reload()

      const loginUrl = new globalThis.URL(page.url())
      const redirectTarget = loginUrl.searchParams.get('redirectTo')
      const expectedTarget = filteredUrl.pathname + filteredUrl.search

      expect(redirectTarget).toBe(expectedTarget)
      await authenticate(context, page, expectedTarget)
      await expect(controls.getByRole('combobox', { name: /^Status/u })).toContainText('Pending')
      await expect(page.getByText(photoFixture.filename)).toBeVisible()
    })

    await test.step('Announce empty results, reset focus, and fit the mobile panel', async () => {
      await status.click()

      await page.getByRole('option', {
        name: 'Rejected',
        exact: true
      }).click()

      await expect(page.getByRole('heading', { name: 'No matching contributions.' })).toBeVisible()

      const clearButton = controls.getByRole('button', { name: 'Clear filters' })

      await clearButton.focus()
      await clearButton.press('Enter')
      await expect(status).toBeFocused()
      await expect(page).toHaveURL(/\/account\/submissions$/u)
      await expect(page.getByRole('heading', { name: 'Item submissions' })).toBeVisible()

      const statusBox = await status.boundingBox()
      const typeBox = await controls.getByRole('combobox', { name: /^Type/u }).boundingBox()

      expect(typeBox?.y).toBeGreaterThan(statusBox?.y ?? 0)

      const fitsViewport = await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)

      expect(fitsViewport).toBe(true)
    })
  })

  test('should cancel stale first pages and load-more requests when filters change', async ({ context, page }) => {
    const heldFirst = createDeferred()
    const heldMore = createDeferred()

    await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
      const request = route.request()
      const requestAddress = request.url()
      const url = new globalThis.URL(requestAddress)

      if (url.searchParams.get('status') === 'rejected') {
        await heldFirst.promise

        return
      }

      if (url.searchParams.get('page') === '2') {
        await heldMore.promise

        return
      }

      await route.fulfill({ json: {
        items: [photoFixture],
        nextPage: 2
      } })
    })

    await authenticate(context, page, '/account/submissions?type=photos')

    const controls = page.getByRole('group', { name: 'Contribution filters' })
    const status = controls.getByRole('combobox', { name: /^Status/u })

    await expect(page.getByText(photoFixture.filename)).toBeVisible()

    const moreStarted = page.waitForRequest(request => {
      const requestAddress = request.url()
      const url = new globalThis.URL(requestAddress)

      return url.searchParams.get('page') === '2'
    })

    await page.getByRole('button', { name: 'Load more photo submissions' }).click()

    const moreRequest = await moreStarted
    const moreFailed = page.waitForEvent('requestfailed', request => request === moreRequest)

    await status.click()

    const firstStarted = page.waitForRequest(request => {
      const requestAddress = request.url()
      const url = new globalThis.URL(requestAddress)

      return url.searchParams.get('status') === 'rejected'
    })

    await page.getByRole('option', {
      name: 'Rejected',
      exact: true
    }).click()

    const firstRequest = await firstStarted

    await moreFailed

    heldMore.resolve()

    const firstFailed = page.waitForEvent('requestfailed', request => request === firstRequest)

    await status.click()

    await page.getByRole('option', {
      name: 'Pending',
      exact: true
    }).click()

    await firstFailed

    heldFirst.resolve()
    await expect(page.getByText(photoFixture.filename)).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Load more photo submissions' })).toBeEnabled()
  })
})

test('should retry only the selected type and restore filters after visiting a contribution', async ({ context, page }) => {
  let succeeds = false
  let photoRequests = 0
  const statuses: (string | null)[] = []

  await mockItemDetailApi(context, {
    ...stoveItem,
    id: publishedItemId,
    name: 'Published corrected stove'
  })

  await context.route((url) => url.pathname === submissionsPath, async (route) => {
    const request = route.request()
    const requestAddress = request.url()
    const requestUrl = new globalThis.URL(requestAddress)
    const status = requestUrl.searchParams.get('status')

    statuses.push(status)

    if (succeeds === false) {
      await route.fulfill({
        status: 500,
        json: { message: 'Temporary failure' }
      })

      return
    }

    const submissions = createSubmissions()
    const items = submissions.filter(item => item.status === 'approved')

    await route.fulfill({ json: { items } })
  })

  await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
    photoRequests += 1

    await route.fulfill({ json: {
      items: [],
      nextPage: null
    } })
  })

  await authenticate(context, page, '/account/submissions?status=approved&type=gear')

  const controls = page.getByRole('group', { name: 'Contribution filters' })

  await expect(page.getByText('My contributions unavailable.')).toBeVisible()
  await expect(controls).toBeVisible()

  succeeds = true

  await page.getByRole('button', { name: 'Retry' }).click()
  await page.getByRole('link', { name: 'Published corrected stove' }).click()
  await expect(page.getByRole('heading', { name: 'Published corrected stove' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/status=approved&type=gear/u)
  await expect(controls.getByRole('combobox', { name: /^Status/u })).toContainText('Published')
  await expect(page.getByRole('link', { name: 'Published corrected stove' })).toBeVisible()
  expect(statuses.length).toBeGreaterThan(1)

  const allStatusesApproved = statuses.every(status => status === 'approved')

  expect(allStatusesApproved).toBe(true)
  expect(photoRequests).toBe(0)
})

test('should keep the active status on subsequent photo pages', async ({ context, page }) => {
  const secondPhoto = {
    ...photoFixture,
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
    filename: 'Second pending photo.webp'
  }

  const approvedPhoto = {
    ...photoFixture,
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
    filename: 'Other status photo.webp',
    status: 'approved'
  }

  await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
    const request = route.request()
    const address = request.url()
    const url = new globalThis.URL(address)

    if (url.searchParams.get('page') === '1') {
      await route.fulfill({ json: {
        items: [photoFixture],
        nextPage: 2
      } })

      return
    }

    const items = url.searchParams.get('status') === 'pending' ? [secondPhoto] : [secondPhoto, approvedPhoto]

    await route.fulfill({ json: {
      items,
      nextPage: null
    } })
  })

  await authenticate(context, page, '/account/submissions?status=pending&type=photos')
  await expect(page.getByText(photoFixture.filename)).toBeVisible()

  const nextRequest = page.waitForRequest(request => {
    const address = request.url()
    const url = new globalThis.URL(address)

    return url.pathname === photoSubmissionsPath && url.searchParams.get('page') === '2'
  })

  await page.getByRole('button', { name: 'Load more photo submissions' }).click()

  const request = await nextRequest
  const address = request.url()
  const url = new globalThis.URL(address)
  const status = url.searchParams.get('status')

  expect(status).toBe('pending')
  await expect(page.getByText(secondPhoto.filename)).toBeVisible()
  await expect(page.getByText(approvedPhoto.filename)).toHaveCount(0)
})

test('should announce filter outcomes and restore focus from the empty-state reset', async ({ context, page }) => {
  const firstResponse = createDeferred()

  await context.route((url) => url.pathname === submissionsPath, async (route) => {
    await route.fulfill({ json: { items: [] } })
  })

  let shouldSucceed = false

  await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
    const request = route.request()
    const address = request.url()
    const url = new globalThis.URL(address)
    const status = url.searchParams.get('status')

    if (status === 'pending') {
      await firstResponse.promise
    }

    if (status === 'approved' && shouldSucceed === false) {
      await route.fulfill({
        status: 500,
        json: { message: 'Temporary failure' }
      })

      return
    }

    const items = status === 'rejected' ? [] : [photoFixture]

    await route.fulfill({ json: {
      items,
      nextPage: null
    } })
  })

  await authenticate(context, page, '/account/submissions?status=pending&type=photos')

  const controls = page.getByRole('group', { name: 'Contribution filters' })
  const status = controls.getByRole('combobox', { name: /^Status/u })
  const announcement = page.getByRole('status')

  try {
    await test.step('Announce loading and completion without moving focus', async () => {
      await expect(announcement).toHaveAttribute('aria-live', 'polite')
      await expect(announcement).toHaveAttribute('aria-atomic', 'true')
      await expect(announcement).toHaveText('Loading contributions.')
      firstResponse.resolve()
      await expect(announcement).toHaveText('Contributions loaded.')
    })

  } finally {
    firstResponse.resolve()
  }

  await test.step('Announce no matches and hand off focus after the empty-state reset', async () => {
    await status.click()

    await page.getByRole('option', {
      name: 'Rejected',
      exact: true
    }).click()

    await expect(announcement).toHaveText('No matching contributions.')

    const emptyState = page.getByRole('heading', { name: 'No matching contributions.' }).locator('..')
    const reset = emptyState.getByRole('button', { name: 'Clear filters' })

    await reset.focus()
    await reset.press('Enter')
    await expect(status).toBeFocused()
    await expect(announcement).toHaveText('Contributions loaded.')
  })

  await test.step('Announce a failed filter request and its successful retry', async () => {
    await status.click()

    await page.getByRole('option', {
      name: 'Published',
      exact: true
    }).click()

    await expect(announcement).toHaveText('Could not load contributions. Try again.')

    shouldSucceed = true

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(announcement).toHaveText('Contributions loaded.')
  })
})
