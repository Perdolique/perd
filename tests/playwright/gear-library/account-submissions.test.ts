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

async function expectLayoutFits(page: Page) {
  const controls = page.getByRole('group', { name: 'Contribution filters' })

  await expect(controls.getByRole('radio')).toHaveCount(7)

  const clippedChoices = await controls.locator('label').evaluateAll(labels => {
    const invalidLabels = labels.filter(label => {
      const box = label.getBoundingClientRect()
      const text = label.querySelector('span')
      const range = globalThis.document.createRange()

      if (text === null) {
        return true
      }

      range.selectNodeContents(text)

      const textBox = range.getBoundingClientRect()

      const isClipped = box.width < 44 || box.height < 44 || box.x < 0
        || box.right > globalThis.innerWidth || textBox.x < box.x || textBox.right > box.right

      return isClipped
    })

    const invalidLabelTexts = invalidLabels.map(label => label.textContent)

    return invalidLabelTexts
  })

  expect(clippedChoices).toEqual([])

  const cardsFit = await page.getByRole('article').evaluateAll(cards => {
    const allCardsFit = cards.every(card => {
      const box = card.getBoundingClientRect()
      const fits = card.scrollWidth <= card.clientWidth && box.x >= 0 && box.right <= globalThis.innerWidth

      return fits
    })

    return allCardsFit
  })

  expect(cardsFit).toBe(true)

  const clippedText = await page.getByRole('article').locator('h3, h3 + p').evaluateAll(elements => {
    const clippedElements = elements.filter(element => {
      const range = globalThis.document.createRange()

      range.selectNodeContents(element)

      const lines = [...range.getClientRects()]
      const card = element.closest('article')
      let ancestor: Element | null = element

      while (ancestor !== null) {
        const bounds = ancestor.getBoundingClientRect()

        const hasOverflow = lines.some(line => line.left < bounds.left - 1 || line.right > bounds.right + 1
          || line.top < bounds.top - 1 || line.bottom > bounds.bottom + 1)

        if (hasOverflow) {
          return true
        }

        if (ancestor === card) {
          break
        }

        ancestor = ancestor.parentElement
      }

      return false
    })

    const clippedTexts = clippedElements.map(element => element.textContent)

    return clippedTexts
  })

  expect(clippedText).toEqual([])

  const fitsViewport = await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)

  expect(fitsViewport).toBe(true)
}

async function expectDockAtViewportBottom(page: Page) {
  const dock = page.getByTestId('shell-dock')
  const isMobile = await page.evaluate(() => globalThis.innerWidth < 900)

  if (isMobile === false) {
    await expect(dock).toBeHidden()

    return
  }

  await expect(dock).toBeVisible()

  const box = await dock.boundingBox()
  const viewportHeight = await page.evaluate(() => globalThis.innerHeight)

  if (box === null) {
    throw new Error('Expected visible mobile navigation')
  }

  expect(box.y + box.height).toBeCloseTo(viewportHeight, 0)
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
    await expect(page.getByText('Loading gear contributions…')).toBeVisible()
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
    await expect(page.getByText('Piezo ignition')).toBeHidden()
    await expect(page.getByText('Duplicate catalog item')).toBeVisible()

    const publishedDetails = page.getByText('Submission details for Published corrected stove', { exact: true })

    await publishedDetails.focus()
    await publishedDetails.press('Space')
    await expect(page.getByText('Piezo ignition')).toBeVisible()
    await expect(page.getByText('No', { exact: true })).toBeVisible()
    await page.getByText('Submission details for Pending stove', { exact: true }).click()

    const pendingCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Pending stove' }) })

    await expect(pendingCard.getByText('83.5 g')).toBeVisible()
    await expect(pendingCard.getByText('Last updated')).toBeVisible()
    await expect(page.getByText('Duplicate catalog item')).toBeVisible()
  })

  test('should retry a failed request and show the empty state', async ({ context, page }) => {
    await page.setViewportSize({
      width: 360,
      height: 900
    })

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
    await expect(page.getByText('Could not load gear contributions.')).toBeVisible()

    shouldSucceed = true

    const retry = page.getByRole('button', { name: 'Retry gear' })

    await retry.focus()
    await retry.press('Enter')
    await expect(page.getByRole('heading', { name: 'No contributions yet.' })).toBeVisible()

    const allTypes = page.getByRole('group', {
      name: 'Type',
      exact: true
    }).getByRole('radio', {
      name: 'All',
      exact: true
    })

    await expect(allTypes).toBeFocused()
    await expectDockAtViewportBottom(page)

    await expect(page.getByRole('link', { name: 'Submit gear' })).toHaveAttribute(
      'href',
      '/gear-library/new'
    )
  })

  test('should keep photo loading and error states retryable independently', async ({ context, page }) => {
    const firstPhotoResponseGate = createDeferred()
    const gearResponseGate = createDeferred()
    let photoRequestCount = 0
    let gearRequestCount = 0
    let shouldPhotoRequestSucceed = false

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      gearRequestCount += 1

      await gearResponseGate.promise

      const items = createSubmissions()

      await route.fulfill({ json: { items } })
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

    try {
      await expect(page.getByText('Loading photo contributions…')).toBeVisible()
      await expect(page.getByText('Loading gear contributions…')).toBeVisible()
      firstPhotoResponseGate.resolve()
      await expect(page.getByRole('button', { name: 'Retry photos' })).toBeVisible()
      await expect(page.getByText('Loading gear contributions…')).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('Some contributions could not be loaded. Retry the affected section.')
    } finally {
      firstPhotoResponseGate.resolve()
      gearResponseGate.resolve()
    }

    await expect(page.getByText('Could not load photo contributions.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pending stove' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Some contributions could not be loaded. Retry the affected section.')

    const failedPhotoRequestCount = photoRequestCount

    shouldPhotoRequestSucceed = true

    const retry = page.getByRole('button', { name: 'Retry photos' })

    await retry.focus()
    await retry.press('Enter')
    await expect(page.getByRole('heading', { name: 'Photo contributions' })).toBeVisible()
    await expect(page.getByText('PocketRocket camp.webp', { exact: true })).toBeVisible()
    await expect(page.getByText('Own photo')).toBeVisible()
    await expect.poll(() => photoRequestCount).toBeGreaterThan(failedPhotoRequestCount)
    expect(gearRequestCount).toBe(1)
    await expect(page.getByRole('region', { name: 'Photo contributions' })).toBeFocused()
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

    await expect(page.getByText(firstPhoto.filename, { exact: true })).toBeVisible()
    await loadMoreButton.click()

    await expect(page.getByRole('alert')).toHaveText(
      'Could not load more photo submissions. Try again.'
    )

    await loadMoreButton.click()
    await expect(page.getByText(firstPhoto.filename, { exact: true })).toHaveCount(1)
    await expect(page.getByText(secondPhoto.filename, { exact: true })).toBeVisible()
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
            filename: 'Manufacturer image.webp',
            sourceType: 'manufacturer',
            sourceUrl: 'https://example.com/stove',
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

    const manufacturerCard = page.getByRole('article').filter({ has: page.getByText('Manufacturer image.webp', { exact: true }) })
    const sourceLink = manufacturerCard.getByRole('link', { name: 'Manufacturer source' })
    const details = manufacturerCard.locator('summary')

    await expect(manufacturerCard.getByText('Official manufacturer photo', { exact: false })).toBeVisible()
    await expect(sourceLink).toBeHidden()
    await details.focus()
    await details.press('Enter')
    await expect(sourceLink).toBeVisible()
    await expect(sourceLink).toHaveAttribute('href', 'https://example.com/stove')
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

    const status = controls.getByRole('group', {
      name: 'Status',
      exact: true
    })

    await page.evaluate(async () => {
      await globalThis.document.fonts.ready
    })

    const initialPanelBox = await controls.boundingBox()

    await test.step('Select status with the keyboard and show only photos', async () => {
      const allStatuses = status.getByRole('radio', {
        name: 'All',
        exact: true
      })

      await allStatuses.focus()
      await allStatuses.press('ArrowRight')

      await expect(status.getByRole('radio', {
        name: 'Pending',
        exact: true
      })).toBeChecked()

      await expect(page).toHaveURL(/status=pending/u)
      await expect(controls.getByRole('button', { name: 'Clear filters' })).toBeVisible()

      const activePanelBox = await controls.boundingBox()

      expect(activePanelBox).toEqual(initialPanelBox)
      await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()

      await controls.getByRole('radio', {
        name: 'Photos',
        exact: true
      }).check()

      await expect(page).toHaveURL(/type=photos/u)
      await expect(page.getByRole('heading', { name: 'Gear contributions' })).toHaveCount(0)
      await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()
    })

    await test.step('Restore filter history and the reload return target', async () => {
      await page.goBack()
      await expect(page.getByRole('heading', { name: 'Gear contributions' })).toBeVisible()
      await page.goForward()

      await expect(controls.getByRole('radio', {
        name: 'Photos',
        exact: true
      })).toBeChecked()

      const filteredUrl = new globalThis.URL(page.url())

      await page.reload()

      const loginUrl = new globalThis.URL(page.url())
      const redirectTarget = loginUrl.searchParams.get('redirectTo')
      const expectedTarget = filteredUrl.pathname + filteredUrl.search

      expect(redirectTarget).toBe(expectedTarget)
      await authenticate(context, page, expectedTarget)

      await expect(status.getByRole('radio', {
        name: 'Pending',
        exact: true
      })).toBeChecked()

      await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()
    })

    await test.step('Announce empty results, reset focus, and fit the mobile panel', async () => {
      await status.getByRole('radio', {
        name: 'Rejected',
        exact: true
      }).check()

      await expect(page.getByRole('heading', { name: 'No matching contributions.' })).toBeVisible()

      const clearButton = controls.getByRole('button', { name: 'Clear filters' })

      await clearButton.focus()
      await clearButton.press('Enter')

      await expect(controls.getByRole('group', {
        name: 'Type',
        exact: true
      }).getByRole('radio', {
        name: 'All',
        exact: true
      })).toBeFocused()

      await expect(page).toHaveURL(/\/account\/submissions$/u)
      await expect(page.getByRole('heading', { name: 'Gear contributions' })).toBeVisible()

      const statusBox = await status.boundingBox()

      const typeBox = await controls.getByRole('group', {
        name: 'Type',
        exact: true
      }).boundingBox()

      expect(statusBox?.y).toBeGreaterThan(typeBox?.y ?? 0)

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

    const status = controls.getByRole('group', {
      name: 'Status',
      exact: true
    })

    await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()

    const moreStarted = page.waitForRequest(request => {
      const requestAddress = request.url()
      const url = new globalThis.URL(requestAddress)

      return url.searchParams.get('page') === '2'
    })

    await page.getByRole('button', { name: 'Load more photo submissions' }).click()

    const moreRequest = await moreStarted
    const moreFailed = page.waitForEvent('requestfailed', request => request === moreRequest)

    const firstStarted = page.waitForRequest(request => {
      const requestAddress = request.url()
      const url = new globalThis.URL(requestAddress)

      return url.searchParams.get('status') === 'rejected'
    })

    await status.getByRole('radio', {
      name: 'Rejected',
      exact: true
    }).check()

    const firstRequest = await firstStarted

    await moreFailed

    heldMore.resolve()

    const firstFailed = page.waitForEvent('requestfailed', request => request === firstRequest)

    await status.getByRole('radio', {
      name: 'Pending',
      exact: true
    }).check()

    await firstFailed

    heldFirst.resolve()
    await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Load more photo submissions' })).toBeEnabled()
  })
})

test('should retry only the selected type and restore filters after visiting a contribution', async ({ context, page }) => {
  let returnGate = createDeferred()
  let isReturning = false
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

    if (isReturning) {
      await returnGate.promise
    }

    const submissions = createSubmissions()
    const published = submissions.find(item => item.status === 'approved')

    const earlierItems = Array.from({ length: 12 }, (unused, index) => {
      const indexText = String(index)
      const suffix = indexText.padStart(12, '0')
      const id = `0195f6e8-8f44-74f6-bc9a-${suffix}`
      const name = `Earlier published stove ${index + 1}`

      return {
        ...published,
        id,
        name
      }
    })

    const items = [...earlierItems, published]

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

  await expect(page.getByText('Could not load gear contributions.')).toBeVisible()
  await expect(controls).toBeVisible()

  const contributionLink = page.getByRole('link', {
    name: 'Published corrected stove',
    exact: true
  })

  const listScroll = await test.step('Retry and open a contribution from the scrolled list', async () => {
    succeeds = true

    await page.getByRole('button', { name: 'Retry gear' }).click()
    await contributionLink.scrollIntoViewIfNeeded()

    const savedScroll = await page.evaluate(() => globalThis.scrollY)

    expect(savedScroll).toBeGreaterThan(500)
    await contributionLink.click()
    await expect(page).toHaveURL(`/gear-library/${publishedItemId}`)
    await expect(page.getByRole('heading', { name: 'Published corrected stove' })).toBeVisible()

    await page.evaluate(() => {
      globalThis.scrollTo(0, 0)
    })

    return savedScroll
  })

  await test.step('Restore filters and scroll after the first page finishes loading', async () => {
    isReturning = true

    try {
      await page.goBack()
      await expect(page).toHaveURL(/status=approved&type=gear/u)
      await expect(page.getByText('Loading gear contributions…')).toBeVisible()
    } finally {
      returnGate.resolve()
    }

    await expect.poll(async () => page.evaluate(() => globalThis.scrollY)).toBeCloseTo(listScroll, 0)

    await expect(controls.getByRole('radio', {
      name: 'Published',
      exact: true
    })).toBeChecked()

    await expect(page.getByRole('link', { name: 'Published corrected stove' })).toBeVisible()
  })

  expect(statuses.length).toBeGreaterThan(1)

  const allStatusesApproved = statuses.every(status => status === 'approved')

  expect(allStatusesApproved).toBe(true)
  expect(photoRequests).toBe(0)

  await test.step('Keep user input ahead of a delayed history restoration', async () => {
    returnGate = createDeferred()

    await contributionLink.click()
    await expect(page).toHaveURL(`/gear-library/${publishedItemId}`)

    try {
      await page.goBack()
      await expect(page).toHaveURL(/status=approved&type=gear/u)
      await expect(page.getByText('Loading gear contributions…')).toBeVisible()
      await page.keyboard.press('Home')
    } finally {
      returnGate.resolve()
    }

    await expect(contributionLink).toBeVisible()
    await expect.poll(async () => page.evaluate(() => globalThis.scrollY)).toBe(0)
  })
})

test('should cancel pending contribution requests when leaving the page', async ({ context, page }) => {
  const heldResponses = createDeferred()

  await context.route((url) => url.pathname === submissionsPath || url.pathname === photoSubmissionsPath, async () => {
    await heldResponses.promise
  })

  const gearStarted = page.waitForRequest(`**${submissionsPath}**`)
  const photoStarted = page.waitForRequest(`**${photoSubmissionsPath}**`)

  try {
    await authenticate(context, page, '/account/submissions')

    const gearRequest = await gearStarted
    const photoRequest = await photoStarted
    const gearFailed = page.waitForEvent('requestfailed', request => request === gearRequest)
    const photoFailed = page.waitForEvent('requestfailed', request => request === photoRequest)

    await page.getByRole('link', { name: 'Back to account' }).click()
    await expect(page).toHaveURL('/account')
    await Promise.all([gearFailed, photoFailed])

    const gearFailure = gearRequest.failure()
    const photoFailure = photoRequest.failure()

    expect(gearFailure?.errorText).toContain('ERR_ABORTED')
    expect(photoFailure?.errorText).toContain('ERR_ABORTED')
    await expect(page.getByRole('alert')).toHaveCount(0)
  } finally {
    heldResponses.resolve()
  }
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
  await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()

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
  await expect(page.getByText(secondPhoto.filename, { exact: true })).toBeVisible()
  await expect(page.getByText(approvedPhoto.filename, { exact: true })).toHaveCount(0)
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

  const status = controls.getByRole('group', {
    name: 'Status',
    exact: true
  })

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
    await status.getByRole('radio', {
      name: 'Rejected',
      exact: true
    }).check()

    await expect(announcement).toHaveText('No matching contributions.')

    const emptyState = page.getByRole('heading', { name: 'No matching contributions.' }).locator('..')
    const reset = emptyState.getByRole('button', { name: 'Clear filters' })

    await reset.focus()
    await reset.press('Enter')

    await expect(controls.getByRole('group', {
      name: 'Type',
      exact: true
    }).getByRole('radio', {
      name: 'All',
      exact: true
    })).toBeFocused()

    await expect(announcement).toHaveText('Contributions loaded.')
  })

  await test.step('Announce a failed filter request and its successful retry', async () => {
    await status.getByRole('radio', {
      name: 'Published',
      exact: true
    }).check()

    await expect(announcement).toHaveText('Could not load contributions. Try again.')

    shouldSucceed = true

    await page.getByRole('button', { name: 'Retry photos' }).click()
    await expect(announcement).toHaveText('Contributions loaded.')
  })
})

test('should keep photo results visible while gear fails and retries', async ({ context, page }) => {
  const gearResponse = createDeferred()
  let shouldSucceed = false
  let photoRequests = 0

  await context.route((url) => url.pathname === submissionsPath, async (route) => {
    await gearResponse.promise

    if (shouldSucceed === false) {
      await route.fulfill({
        status: 500,
        json: { message: 'Temporary gear failure' }
      })

      return
    }

    const items = createSubmissions()

    await route.fulfill({ json: { items } })
  })

  await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
    photoRequests += 1

    await route.fulfill({ json: {
      items: [photoFixture],
      nextPage: null
    } })
  })

  try {
    await authenticate(context, page, '/account/submissions')
    await expect(page.getByText('Loading gear contributions…')).toBeVisible()
    await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()
  } finally {
    gearResponse.resolve()
  }

  await expect(page.getByText('Could not load gear contributions.')).toBeVisible()
  await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()

  shouldSucceed = true

  await page.getByRole('button', { name: 'Retry gear' }).click()
  await expect(page.getByRole('heading', { name: 'Pending stove' })).toBeVisible()
  await expect(page.getByText(photoFixture.filename, { exact: true })).toBeVisible()
  expect(photoRequests).toBe(1)
})

test('should fit visible choices and long contribution names across screen sizes and themes', async ({ context, page }) => {
  const longName = 'WindBurnerPersonalStoveSystemWithExpeditionAccessoriesAndExtendedWarranty'
  const longFilename = 'WindBurnerPersonalStoveSystemWithExpeditionAccessoriesOnOurAutumnTripToTheBalticCoast.webp'

  const photo = {
    ...photoFixture,
    filename: longFilename
  }

  const [baseGear] = createSubmissions()

  const gear = {
    ...baseGear,
    name: longName
  }

  await context.route((url) => url.pathname === submissionsPath, async (route) => {
    await route.fulfill({ json: { items: [gear] } })
  })

  await context.route((url) => url.pathname === photoSubmissionsPath, async (route) => {
    await route.fulfill({ json: {
      items: [photo],
      nextPage: 2
    } })
  })

  await authenticate(context, page, '/account/submissions')
  await expect(page.getByText(longFilename, { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: longName })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(2)

  for (const width of [320, 360, 768, 1440]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      const stepName = `Check ${width}px in ${colorScheme} mode`

      // oxlint-disable-next-line no-await-in-loop -- Each layout check owns the same page viewport and color scheme.
      await test.step(stepName, async () => {
        await page.setViewportSize({
          width,
          height: 1000
        })

        await page.emulateMedia({ colorScheme })

        await page.evaluate(async () => {
          await globalThis.document.fonts.ready
        })

        await expectLayoutFits(page)
        await expectDockAtViewportBottom(page)
      })
    }
  }

  await test.step('Keep the controls usable with 200% text on a narrow screen', async () => {
    await page.setViewportSize({
      width: 320,
      height: 1000
    })

    await page.evaluate(() => {
      globalThis.document.documentElement.style.fontSize = '32px'
    })

    await expectLayoutFits(page)
    await expectDockAtViewportBottom(page)

    const dock = page.getByRole('navigation', { name: 'Primary navigation' })
    const loadMore = page.getByRole('button', { name: 'Load more photo submissions' })

    await page.evaluate(() => {
      globalThis.scrollTo(0, globalThis.document.documentElement.scrollHeight)
    })

    await expect(loadMore).toBeInViewport()

    const dockBox = await dock.boundingBox()
    const buttonBox = await loadMore.boundingBox()

    if (dockBox === null || buttonBox === null) {
      throw new Error('Expected visible navigation and pagination controls')
    }

    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(dockBox.y)
    expect(dockBox.y + dockBox.height).toBeCloseTo(1000, 0)
  })
})
