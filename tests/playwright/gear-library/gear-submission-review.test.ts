import type { BrowserContext, Page, Request, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import {
  createDeferred,
  selectPerdOption
} from '../fixtures/gear-library-entry-list.fixtures.ts'

/* oxlint-disable vitest/no-conditional-in-test -- Playwright route handlers branch on mocked request paths and methods. */

const adminId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477ee'
const secondSubmissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477ef'
const submissionsPath = '/api/equipment/item-submissions'
const detailPath = `${submissionsPath}/${submissionId}`
const guardedAdminTargets = [
  '/admin',
  '/admin/equipment/submissions',
  `/admin/equipment/submissions/${submissionId}`,
  `/admin/equipment/items/${submissionId}/images`
]

const brands = [{ id: 10, name: 'MSR', slug: 'msr' }]
const categories = [{ id: 2, name: 'Stoves', slug: 'stoves' }, {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads'
}]
const stovesCategory = {
  id: 2,
  name: 'Stoves',
  slug: 'stoves',
  properties: [{ dataType: 'number', id: 21, name: 'Weight', slug: 'weight', unit: 'g' }]
}
const sleepingPadsCategory = {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads',
  properties: [{ dataType: 'number', id: 11, name: 'R-value', slug: 'r-value', unit: null }]
}
const listItem = {
  author: { id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ab', name: 'Ada' },
  brand: { id: 10, name: 'MSR' },
  category: { id: 2, name: 'Stoves' },
  createdAt: '2026-08-01T12:00:00.000Z',
  id: submissionId,
  name: 'PocketRocket Deluxe'
}
const detail = {
  ...listItem,
  properties: [{ propertyId: 21, value: '83.5' }],
  rejectionReason: null,
  status: 'pending',
  updatedAt: '2026-08-01T12:30:00.000Z'
}

interface AuthenticationOptions {
  context: BrowserContext;
  isAdmin: boolean;
  page: Page;
  target: string;
}

async function authenticate(options: AuthenticationOptions) {
  const { context, isAdmin, page, target } = options

  await context.route((url) => url.pathname === '/api/oauth/twitch', async (route) => {
    await route.fulfill({
      json: {
        isAdmin,
        isGuest: false,
        userId: adminId
      }
    })
  })

  const state = encodeURIComponent(target)

  await page.goto(`/auth/twitch?code=twitch-code&state=${state}`)
}

async function mockReferences(context: BrowserContext) {
  await context.route((url) => url.pathname === '/api/equipment/brands', async (route) => {
    await route.fulfill({ json: brands })
  })
  await context.route((url) => url.pathname === '/api/equipment/categories', async (route) => {
    await route.fulfill({ json: categories })
  })
  await context.route((url) => url.pathname.includes('/categories/by-slug/'), async (route) => {
    const request = route.request()
    const { pathname } = new globalThis.URL(request.url())
    const response = pathname.endsWith('/sleeping-pads') ? sleepingPadsCategory : stovesCategory

    await route.fulfill({ json: response })
  })
}

function getSelect(page: Page, label: 'Brand' | 'Category') {
  return page.getByRole('combobox', { name: new RegExp(`^${label}`, 'u') })
}

function isStovesCategoryDetailRequest(request: Request) {
  return request.url().endsWith('/api/equipment/categories/by-slug/stoves')
}

function createGatedInitialCategoryResponder(gate: Promise<void>) {
  return async (route: Route) => {
    const request = route.request()
    const { pathname } = new globalThis.URL(request.url())

    if (pathname.endsWith('/stoves')) {
      await gate

      return
    }

    await route.fulfill({ json: sleepingPadsCategory })
  }
}

test.describe('Admin gear submission review', () => {
  test('should expose Admin only to admins while keeping the mobile dock at four items', async ({
    context,
    page
  }) => {
    await authenticate({ context, isAdmin: true, page, target: '/' })

    await expect(page.getByRole('navigation', { name: 'Workspace navigation' }).getByText('Admin')).toBeVisible()

    await page.setViewportSize({ height: 800, width: 390 })
    const dock = page.getByTestId('shell-dock')

    await expect(dock).toBeVisible()
    await dock.getByRole('link', { name: 'Profile' }).click()

    await expect(dock.getByRole('link')).toHaveCount(4)
    await expect(page.getByRole('link', { name: /Admin/u })).toBeVisible()
  })

  for (const target of guardedAdminTargets) {
    test(`should guard ${target} before any admin API request`, async ({ context, page }) => {
      let adminRequestCount = 0

      page.on('request', (request) => {
        const { pathname } = new globalThis.URL(request.url())
        const isAdminDataRequest = pathname.startsWith(submissionsPath)
          || pathname.startsWith('/api/equipment/items/')

        if (isAdminDataRequest) {
          adminRequestCount += 1
        }
      })

      await authenticate({ context, isAdmin: false, page, target })

      await expect(page).toHaveURL(/\/$/u)
      expect(adminRequestCount).toBe(0)
      await expect(page.getByRole('navigation', { name: 'Workspace navigation' }).getByText('Admin')).toHaveCount(0)
    })
  }

  test('should navigate from the dashboard and append the next oldest queue page', async ({
    context,
    page
  }) => {
    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      const requestUrl = new globalThis.URL(route.request().url())
      const pageNumber = requestUrl.searchParams.get('page')
      const secondItem = {
        ...listItem,
        author: null,
        createdAt: '2026-08-02T12:00:00.000Z',
        id: secondSubmissionId,
        name: 'Deleted user item'
      }

      await route.fulfill({
        json: {
          items: pageNumber === '2' ? [secondItem] : [listItem],
          limit: 20,
          page: Number(pageNumber),
          total: 2
        }
      })
    })

    await authenticate({ context, isAdmin: true, page, target: '/admin' })
    await page.getByRole('link', { name: /Review gear submissions/u }).click()

    await expect(page).toHaveURL(/\/admin\/equipment\/submissions$/u)
    await expect(page.getByRole('link', { name: /PocketRocket Deluxe/u })).toBeVisible()
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByRole('link', { name: /Deleted user item/u })).toContainText('Deleted account')
    const paginationStatus = page.getByText('All pending submissions are loaded.', { exact: true })

    await expect(paginationStatus).toHaveAttribute('role', 'status')
    await expect(paginationStatus).toBeFocused()
    await expect(page.getByText('UTC').first()).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/equipment\/submissions$/u)
  })

  test('should retry an initial queue error and show the empty state', async ({ context, page }) => {
    let allowSuccess = false
    let requestCount = 0

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      requestCount += 1

      if (allowSuccess === false) {
        await route.fulfill({ json: { message: 'Temporary failure' }, status: 500 })

        return
      }

      await route.fulfill({
        json: {
          items: [],
          limit: 20,
          page: 1,
          total: 0
        }
      })
    })

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: '/admin/equipment/submissions'
    })
    await expect(page.getByText('Gear submissions unavailable.')).toBeVisible()
    const requestCountBeforeRetry = requestCount

    allowSuccess = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('The review queue is clear.')).toBeVisible()
    expect(requestCount).toBeGreaterThan(requestCountBeforeRetry)
  })

  test('should prefill, save an exact full replacement, and adopt the response baseline', async ({
    context,
    page
  }) => {
    const patchRequests: Request[] = []

    await mockReferences(context)
    await context.route((url) => url.pathname === detailPath, async (route) => {
      const request = route.request()

      if (request.method() === 'PATCH') {
        patchRequests.push(request)
        await route.fulfill({
          json: {
            ...detail,
            name: 'PocketRocket Deluxe 2',
            updatedAt: '2026-08-01T12:31:00.000Z'
          }
        })

        return
      }

      await route.fulfill({ json: detail })
    })

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/submissions/${submissionId}`
    })

    const saveButton = page.getByRole('button', { name: 'Save changes' })

    await expect(page.getByLabel('Item name')).toHaveValue('PocketRocket Deluxe')
    await expect(page.getByLabel('Weight')).toHaveValue('83.5')
    await expect(saveButton).toBeDisabled()
    await page.getByLabel('Item name').fill('PocketRocket Deluxe 2')
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expect.poll(() => patchRequests).toHaveLength(1)

    const [patchRequest] = patchRequests

    expect(patchRequest.postDataJSON()).toStrictEqual({
      brandId: 10,
      categoryId: 2,
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'PocketRocket Deluxe 2',
      properties: [{ propertyId: 21, value: '83.5' }]
    })
    await expect(page.getByRole('status')).toHaveText('Changes saved.')
    await expect(page.getByRole('status')).toBeFocused()
    await expect(saveButton).toBeDisabled()
    await expect(page.getByText('UTC')).toBeVisible()
  })

  test('should publish the current unsaved edits and focus the terminal state', async ({
    context,
    page
  }) => {
    const patchRequests: Request[] = []

    await mockReferences(context)
    await context.route((url) => url.pathname === detailPath, async (route) => {
      const request = route.request()

      if (request.method() === 'PATCH') {
        patchRequests.push(request)
        await route.fulfill({
          json: {
            ...detail,
            name: 'Published corrected name',
            status: 'approved',
            updatedAt: '2026-08-01T12:31:00.000Z'
          }
        })

        return
      }

      await route.fulfill({ json: detail })
    })
    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/submissions/${submissionId}`
    })
    await page.getByLabel('Item name').fill('Published corrected name')
    await page.getByRole('button', { name: 'Publish', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Publish submission' })

    await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect.poll(() => patchRequests).toHaveLength(1)
    expect(patchRequests[0]?.postDataJSON()).toStrictEqual({
      brandId: 10,
      categoryId: 2,
      decision: 'publish',
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'Published corrected name',
      properties: [{ propertyId: 21, value: '83.5' }]
    })

    const terminalStatus = page.getByRole('status').filter({ hasText: 'Published' })

    await expect(terminalStatus).toBeVisible()
    await expect(terminalStatus).toBeFocused()
    await expect(terminalStatus.getByRole('link', { name: 'Back to submissions' })).toBeVisible()
    await expect(page.getByLabel('Item name')).toHaveCount(0)
  })

  test('should require and preserve a rejection reason while retrying unsaved edits', async ({
    context,
    page
  }) => {
    const patchRequests: Request[] = []

    await mockReferences(context)
    await context.route((url) => url.pathname === detailPath, async (route) => {
      const request = route.request()

      if (request.method() === 'PATCH') {
        patchRequests.push(request)

        if (patchRequests.length === 1) {
          await route.fulfill({ json: { message: 'Raw technical detail' }, status: 500 })

          return
        }

        await route.fulfill({
          json: {
            ...detail,
            name: 'Rejected corrected name',
            rejectionReason: 'Duplicate catalog item',
            status: 'rejected',
            updatedAt: '2026-08-01T12:31:00.000Z'
          }
        })

        return
      }

      await route.fulfill({ json: detail })
    })
    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/submissions/${submissionId}`
    })
    await page.getByLabel('Item name').fill('Rejected corrected name')
    await page.getByRole('button', { name: 'Reject', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Reject submission' })
    const confirmButton = dialog.getByRole('button', { name: 'Reject', exact: true })

    await expect(confirmButton).toBeDisabled()
    await dialog.getByLabel('Reason').fill('   ')
    await expect(confirmButton).toBeDisabled()
    await dialog.getByLabel('Reason').fill('Duplicate catalog item')
    await confirmButton.click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Could not apply this decision. Your edits are still here. Try again.')).toBeVisible()
    await expect(page.getByLabel('Item name')).toHaveValue('Rejected corrected name')
    await page.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect(dialog.getByLabel('Reason')).toHaveValue('Duplicate catalog item')
    await dialog.getByRole('button', { name: 'Reject', exact: true }).click()
    await expect.poll(() => patchRequests).toHaveLength(2)
    expect(patchRequests[1]?.postDataJSON()).toStrictEqual({
      brandId: 10,
      categoryId: 2,
      decision: 'reject',
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'Rejected corrected name',
      properties: [{ propertyId: 21, value: '83.5' }],
      rejectionReason: 'Duplicate catalog item'
    })

    const terminalStatus = page.getByRole('status').filter({ hasText: 'Rejected' })

    await expect(terminalStatus).toBeVisible()
    await expect(terminalStatus).toBeFocused()
  })

  test('should confirm a destructive category change before the initial properties load', async ({
    context,
    page
  }) => {
    const initialCategoryGate = createDeferred()
    const patchRequests: Request[] = []

    await context.route((url) => url.pathname === '/api/equipment/brands', async (route) => {
      await route.fulfill({ json: brands })
    })
    await context.route((url) => url.pathname === '/api/equipment/categories', async (route) => {
      await route.fulfill({ json: categories })
    })
    await context.route(
      (url) => url.pathname.includes('/categories/by-slug/'),
      createGatedInitialCategoryResponder(initialCategoryGate.promise)
    )
    await context.route((url) => url.pathname === detailPath, async (route) => {
      if (route.request().method() === 'PATCH') {
        patchRequests.push(route.request())
        await route.fulfill({
          json: {
            ...detail,
            category: { id: 1, name: 'Sleeping Pads' },
            properties: [],
            updatedAt: '2026-08-01T12:31:00.000Z'
          }
        })

        return
      }

      await route.fulfill({ json: detail })
    })

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/submissions/${submissionId}`
    })
    await expect(page.getByText('Loading characteristics…')).toBeVisible()

    const staleRequestFailure = page.waitForEvent('requestfailed', isStovesCategoryDetailRequest)

    await selectPerdOption(getSelect(page, 'Category'), 'sleeping-pads')
    const dialog = page.getByRole('dialog', { name: 'Change category' })

    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Change category' }).click()

    const failedRequest = await staleRequestFailure

    expect(failedRequest.failure()?.errorText).toContain('ERR_ABORTED')
    initialCategoryGate.resolve()
    await expect(page.getByLabel('R-value')).toBeVisible()
    await expect(page.getByLabel('Weight')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect.poll(() => patchRequests).toHaveLength(1)
    expect(patchRequests[0]?.postDataJSON()).toStrictEqual({
      brandId: 10,
      categoryId: 1,
      expectedUpdatedAt: '2026-08-01T12:30:00.000Z',
      name: 'PocketRocket Deluxe',
      properties: []
    })
  })

  test('should preserve fields when category change is cancelled and block saving after 409', async ({
    context,
    page
  }) => {
    let patchCount = 0

    await test.step('prepare the review page and mutation responses', async () => {
      await page.setViewportSize({ height: 800, width: 415 })
      await mockReferences(context)
      await context.route((url) => url.pathname === detailPath, async (route) => {
        if (route.request().method() === 'PATCH') {
          patchCount += 1

          if (patchCount === 1) {
            await route.fulfill({ json: { message: 'Temporary failure' }, status: 500 })

            return
          }

          await route.fulfill({ json: { message: 'No longer pending' }, status: 409 })

          return
        }

        await route.fulfill({ json: detail })
      })

      await authenticate({
        context,
        isAdmin: true,
        page,
        target: `/admin/equipment/submissions/${submissionId}`
      })
    })

    const dialog = page.getByRole('dialog', { name: 'Change category' })

    await test.step('cancel a category change without losing fields', async () => {
      await expect(page.getByLabel('Weight')).toHaveValue('83.5')
      await selectPerdOption(getSelect(page, 'Category'), 'sleeping-pads')
      await expect(dialog).toBeVisible()

      const dialogWidths = await dialog.evaluate((element) => {
        if (element instanceof globalThis.HTMLElement === false) {
          throw new TypeError('Expected the confirmation dialog to be an HTML element')
        }

        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth
        }
      })

      expect(dialogWidths.clientWidth).toBeGreaterThan(350)
      expect(dialogWidths.scrollWidth).toBe(dialogWidths.clientWidth)
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(getSelect(page, 'Category')).toHaveAttribute('data-value', 'stoves')
      await expect(page.getByLabel('Weight')).toHaveValue('83.5')
    })

    await test.step('preserve edits after a temporary save failure', async () => {
      await page.getByLabel('Item name').fill('Changed name')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(page.getByText('Could not save changes. Your edits are still here. Try again.')).toBeVisible()
      await expect(page.getByLabel('Item name')).toHaveValue('Changed name')
    })

    await test.step('focus the terminal conflict after a stale save', async () => {
      await page.getByRole('button', { name: 'Save changes' }).click()
      const conflict = page.getByRole('alert').filter({
        hasText: 'This submission changed while you were reviewing it.'
      })

      await expect(conflict).toBeVisible()
      await expect(conflict).toBeFocused()
      await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
    })
  })
})
