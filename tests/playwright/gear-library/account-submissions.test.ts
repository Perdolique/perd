import type { BrowserContext, Page } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

/* oxlint-disable vitest/no-conditional-in-test -- Playwright route handlers branch across sequential mocked responses. */

const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const submissionsPath = '/api/user/item-submissions'

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
    brand: { id: 10, name: 'MSR' },
    category: { id: 2, name: 'Stoves' },
    createdAt: '2026-08-01T12:00:00.000Z',
    properties: [{ name: 'Weight', propertyId: 21, unit: 'g', value: '83.5' }],
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
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2',
    name: 'Published corrected stove',
    properties: [{ name: 'Piezo ignition', propertyId: 22, unit: null, value: false }],
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
    await authenticate(context, page, '/account')

    const submissionsLink = page.getByRole('link', { name: /Gear submissions/u })

    await expect(submissionsLink).toBeVisible()
    await submissionsLink.click()
    await expect(page.getByText('Loading gear submissions')).toBeVisible()
    responseGate.resolve()

    await expect(page).toHaveURL(/\/account\/submissions$/u)
    await expect(page.getByText('Pending', { exact: true })).toBeVisible()
    await expect(page.getByText('Published', { exact: true })).toBeVisible()
    await expect(page.getByText('Rejected', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Published corrected stove' })).toBeVisible()
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

      await route.fulfill({ json: { message: 'Temporary failure' }, status: 500 })
    })
    await authenticate(context, page, '/account/submissions')
    await expect(page.getByText('Gear submissions unavailable.')).toBeVisible()
    shouldSucceed = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('No gear submissions yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Submit gear' })).toHaveAttribute(
      'href',
      '/gear-library/new'
    )
  })
})
