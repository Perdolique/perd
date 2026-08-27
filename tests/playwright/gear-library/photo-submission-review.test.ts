import type { BrowserContext, Page, Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

/* oxlint-disable vitest/no-conditional-in-test -- Playwright route handlers branch across mocked pages and retries. */
const adminId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const secondSubmissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const submissionsPath = '/api/equipment/photo-submissions'
const detailPath = `${submissionsPath}/${submissionId}`
const previewPath = `${detailPath}/image`
const photoFixturePath = 'tests/playwright/fixtures/photo-submission.webp'

const listItem = {
  author: {
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ab',
    name: 'Ada'
  },

  createdAt: '2026-08-01T12:00:00.000Z',
  filename: 'PocketRocket official.webp',
  id: submissionId,

  item: {
    brand: {
      id: 10,
      name: 'MSR'
    },

    category: {
      id: 2,
      name: 'Stoves'
    },

    id: itemId,
    name: 'PocketRocket Deluxe'
  }
} as const

const detail = {
  ...listItem,
  hasExistingImages: true,
  previewUrl: previewPath,
  rightsConfirmed: true,
  sourceType: 'manufacturer',
  sourceUrl: 'https://www.msrgear.com/pocketrocket',
  updatedAt: '2026-08-01T12:30:00.000Z'
} as const

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

test.describe('Admin photo submission review', () => {
  for (const target of [
    '/admin/equipment/photo-submissions',
    `/admin/equipment/photo-submissions/${submissionId}`
  ]) {
    test(`should guard ${target} before any photo review API request`, async ({ context, page }) => {
      let photoReviewRequestCount = 0

      page.on('request', (request) => {
        if (new globalThis.URL(request.url()).pathname.startsWith(submissionsPath)) {
          photoReviewRequestCount += 1
        }
      })

      await authenticate({
        context,
        isAdmin: false,
        page,
        target
      })

      await expect(page).toHaveURL(/\/$/u)
      expect(photoReviewRequestCount).toBe(0)
    })
  }

  test('should navigate from Admin and append the next oldest photo page', async ({ context, page }) => {
    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      const pageNumber = new globalThis.URL(route.request().url()).searchParams.get('page')

      const secondItem = {
        ...listItem,
        author: null,
        createdAt: '2026-08-02T12:00:00.000Z',
        filename: 'Second photo.webp',
        id: secondSubmissionId
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

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: '/admin'
    })
    await page.getByRole('link', { name: /Review photo submissions/u }).click()
    await expect(page).toHaveURL(/\/admin\/equipment\/photo-submissions$/u)
    await expect(page.getByRole('link', { name: /PocketRocket Deluxe/u })).toBeVisible()
    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByRole('link', { name: /Second photo/u })).toContainText('Deleted account')

    const paginationStatus = page.getByRole('status')

    await expect(paginationStatus).toHaveText('All pending photo submissions are loaded.')
    await expect(paginationStatus).toBeFocused()
    await expect(page.getByText('UTC').first()).toBeVisible()
  })

  test('should retry an unavailable queue and show its empty state', async ({ context, page }) => {
    let shouldSucceed = false

    await context.route((url) => url.pathname === submissionsPath, async (route) => {
      if (shouldSucceed === false) {
        await route.fulfill({
          status: 500,
          json: { message: 'Temporary failure' }
        })

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
      target: '/admin/equipment/photo-submissions'
    })
    await expect(page.getByText('Photo submissions unavailable.')).toBeVisible()
    shouldSucceed = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('The photo review queue is clear.')).toBeVisible()
  })

  test('should retry private preview and publish with the existing-gallery primary default', async ({
    context,
    page
  }) => {
    const patchRequests: Request[] = []
    let previewRequestCount = 0

    await context.route((url) => url.pathname === detailPath, async (route) => {
      const request = route.request()

      if (request.method() === 'PATCH') {
        patchRequests.push(request)
        await route.fulfill({
          json: {
            publishedImage: {
              displayOrder: 2,
              id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477da',
              isPrimary: false
            },

            rejectionReason: null,
            status: 'approved'
          }
        })

        return
      }

      await route.fulfill({ json: detail })
    })
    await context.route((url) => url.pathname === previewPath, async (route) => {
      previewRequestCount += 1

      if (previewRequestCount === 1) {
        await route.fulfill({ status: 502 })

        return
      }

      await route.fulfill({
        contentType: 'image/webp',
        path: photoFixturePath
      })
    })

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/photo-submissions/${submissionId}`
    })

    const publishButton = page.getByRole('button', {
      name: 'Publish',
      exact: true
    })

    await expect(page.getByText('Could not load the private photo preview.')).toBeVisible()
    await expect(publishButton).toBeDisabled()
    await page.getByRole('button', { name: 'Retry preview' }).click()
    await expect(page.getByRole('img', { name: 'Submitted photo PocketRocket official.webp' })).toBeVisible()
    await expect(page.getByText('MSR · Stoves')).toBeVisible()
    await expect(page.getByText('Ada', { exact: true })).toBeVisible()
    await expect(page.getByText('Official manufacturer photo')).toBeVisible()
    await expect(page.getByText('Yes', { exact: true })).toBeVisible()

    const primaryCheckbox = page.getByRole('checkbox', { name: 'Make primary image' })

    await expect(primaryCheckbox).toBeEnabled()
    await expect(primaryCheckbox).not.toBeChecked()
    await publishButton.click()
    await page.getByRole('dialog', { name: 'Publish photo submission' })
      .getByRole('button', {
        name: 'Publish',
        exact: true
      })
      .click()
    await expect.poll(() => patchRequests).toHaveLength(1)
    expect(patchRequests[0]?.postDataJSON()).toStrictEqual({
      decision: 'publish',
      makePrimary: false
    })

    const terminalStatus = page.getByRole('status')

    await expect(terminalStatus).toContainText('Published')
    await expect(terminalStatus).toBeFocused()
    await expect(page.getByRole('link', { name: 'View catalog item' })).toHaveAttribute(
      'href',
      `/gear-library/${itemId}`
    )
  })

  test('should force the first image primary and preserve a rejection reason across retry', async ({
    context,
    page
  }) => {
    const patchRequests: Request[] = []

    await context.route((url) => url.pathname === detailPath, async (route) => {
      const request = route.request()

      if (request.method() === 'PATCH') {
        patchRequests.push(request)

        if (patchRequests.length === 1) {
          await route.fulfill({
            status: 500,
            json: { message: 'Temporary failure' }
          })

          return
        }

        await route.fulfill({
          json: {
            publishedImage: null,
            rejectionReason: 'Product is not visible',
            status: 'rejected'
          }
        })

        return
      }

      await route.fulfill({
        json: {
          ...detail,
          hasExistingImages: false
        }
      })
    })
    await context.route((url) => url.pathname === previewPath, async (route) => {
      await route.fulfill({
        contentType: 'image/webp',
        path: photoFixturePath
      })
    })

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/photo-submissions/${submissionId}`
    })

    const primaryCheckbox = page.getByRole('checkbox', { name: 'Make primary image' })

    await expect(primaryCheckbox).toBeChecked()
    await expect(primaryCheckbox).toBeDisabled()
    await expect(page.getByText(/first gallery image/u)).toBeVisible()
    await page.getByRole('button', {
      name: 'Reject',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Reject photo submission' })
    const reasonInput = dialog.getByLabel('Reason')

    await reasonInput.fill('  Product is not visible  ')
    await dialog.getByRole('button', {
      name: 'Reject',
      exact: true
    }).click()
    await expect(page.getByText('Could not apply this decision. Your choices are still here. Try again.')).toBeVisible()
    await expect(reasonInput).toHaveValue('  Product is not visible  ')
    await dialog.getByRole('button', {
      name: 'Reject',
      exact: true
    }).click()
    await expect.poll(() => patchRequests).toHaveLength(2)
    expect(patchRequests[0]?.postDataJSON()).toStrictEqual({
      decision: 'reject',
      rejectionReason: 'Product is not visible'
    })
    expect(patchRequests[1]?.postDataJSON()).toStrictEqual({
      decision: 'reject',
      rejectionReason: 'Product is not visible'
    })
    await expect(page.getByRole('status')).toContainText('Rejected')
    await expect(page.getByRole('status')).toBeFocused()
  })

  test('should focus a conflict response after a publish decision', async ({ context, page }) => {
    await context.route((url) => url.pathname === detailPath, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 409,
          json: { message: 'Already reviewed' }
        })

        return
      }

      await route.fulfill({ json: detail })
    })
    await context.route((url) => url.pathname === previewPath, async (route) => {
      await route.fulfill({
        contentType: 'image/webp',
        path: photoFixturePath
      })
    })

    await authenticate({
      context,
      isAdmin: true,
      page,
      target: `/admin/equipment/photo-submissions/${submissionId}`
    })
    await page.getByRole('checkbox', { name: 'Make primary image' }).check()
    await page.getByRole('button', {
      name: 'Publish',
      exact: true
    }).click()
    await page.getByRole('dialog', { name: 'Publish photo submission' })
      .getByRole('button', {
        name: 'Publish',
        exact: true
      })
      .click()

    const conflict = page.getByRole('alert')

    await expect(conflict).toContainText('This photo was already reviewed.')
    await expect(conflict).toBeFocused()
  })
})
