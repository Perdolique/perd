import type { BrowserContext, Page, Request, Route } from '@playwright/test'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'

import {
  createDeferred,
  mockCatalogApi,
  mockGuestLogin,
  openGearLibrary,
  selectPerdOption
} from '../fixtures/gear-library-entry-list.fixtures.ts'

const sourceUrl = 'https://shop.example/product?ref=gear#details'
const pendingItemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477ee'

const brands = [{
  id: 10,
  name: 'MSR',
  slug: 'msr'
}]

const categories = [{
  id: 2,
  name: 'Stoves',
  slug: 'stoves'
}, {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads'
}]

const stovesCategory = {
  id: 2,
  name: 'Stoves',
  slug: 'stoves',

  properties: [{
    dataType: 'number',
    id: 21,
    name: 'Weight',
    slug: 'weight',
    unit: 'g'
  }, {
    dataType: 'text',
    id: 24,
    name: 'Notes',
    slug: 'notes',
    unit: null
  }, {
    dataType: 'text',
    id: 25,
    name: 'Manufacturer code',
    slug: 'manufacturer-code',
    unit: null
  }, {
    dataType: 'enum',

    enumOptions: [{
      id: 31,
      name: 'Canister',
      slug: 'canister'
    }],

    id: 23,
    name: 'Fuel type',
    slug: 'fuel-type',
    unit: null
  }, {
    dataType: 'boolean',
    id: 22,
    name: 'Piezo ignition',
    slug: 'piezo-ignition',
    unit: null
  }]
} as const

const sleepingPadsCategory = {
  id: 1,
  name: 'Sleeping Pads',
  slug: 'sleeping-pads',

  properties: [{
    dataType: 'number',
    id: 11,
    name: 'R-value',
    slug: 'r-value',
    unit: null
  }]
} as const

interface SubmissionReferenceMockOptions {
  categoryDetail?: (route: Route) => Promise<void>;
  submit?: (route: Route) => Promise<void>;
}

async function mockSubmissionApi(
  context: BrowserContext,
  options: SubmissionReferenceMockOptions = {}
) {
  await context.route((url) => url.pathname === '/api/equipment/brands', async (route) => {
    await route.fulfill({ json: brands })
  })

  await context.route((url) => url.pathname === '/api/equipment/categories', async (route) => {
    await route.fulfill({ json: categories })
  })

  await context.route((url) => url.pathname.startsWith('/api/equipment/categories/by-slug/'), async (route) => {
    if (options.categoryDetail !== undefined) {
      await options.categoryDetail(route)

      return
    }

    const request = route.request()
    const { pathname } = new globalThis.URL(request.url())
    const response = pathname.endsWith('/sleeping-pads') ? sleepingPadsCategory : stovesCategory

    await route.fulfill({ json: response })
  })

  await context.route((url) => url.pathname === '/api/equipment/item-submissions', async (route) => {
    if (options.submit !== undefined) {
      await options.submit(route)

      return
    }

    await route.fulfill({
      status: 201,

      json: {
        id: pendingItemId,
        status: 'pending'
      }
    })
  })
}

async function openRegisteredSubmissionPage(context: BrowserContext, page: Page) {
  await mockTwitchSignIn(context, page, {
    redirectTo: '/gear-library/new',

    user: {
      email: null,
      isAdmin: false,
      isGuest: false,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
    }
  })

  await expect(page).toHaveURL(/\/gear-library\/new$/u)
}

function getSelect(page: Page, label: 'Brand' | 'Category' | 'Fuel type' | 'Piezo ignition') {
  return page.getByRole('combobox', { name: new RegExp(`^${label}`, 'u') })
}

async function fillBaseFields(page: Page) {
  await page.getByLabel('Item name').fill('PocketRocket Deluxe')
  await page.getByLabel('Source URL').fill(sourceUrl)
  await selectPerdOption(getSelect(page, 'Brand'), '10')
  await selectPerdOption(getSelect(page, 'Category'), 'stoves')
}

function isSubmissionRequest(request: Request) {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === '/api/equipment/item-submissions' && request.method() === 'POST'
}

function isBrandsRequest(request: Request) {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === '/api/equipment/brands' && request.method() === 'GET'
}

function trackSubmissionPageRequests(page: Page) {
  const submissionPagePaths = new Set([
    '/api/equipment/brands',
    '/api/equipment/categories',
    '/api/equipment/item-submissions'
  ])

  let requestCount = 0

  page.on('request', (request) => {
    const { pathname } = new globalThis.URL(request.url())

    requestCount += Number(submissionPagePaths.has(pathname))
  })

  return () => requestCount
}

function trackMyGearPosts(page: Page) {
  let requestCount = 0

  page.on('request', (request) => {
    const requestUrl = new globalThis.URL(request.url())
    const isMyGearPost = requestUrl.pathname === '/api/user/gear' && request.method() === 'POST'

    if (isMyGearPost) {
      requestCount += 1
    }
  })

  return () => requestCount
}

function createRetryingSubmitResponder() {
  let requestCount = 0

  return {
    getRequestCount: () => requestCount,

    respond: async (route: Route) => {
      requestCount += 1

      if (requestCount === 1) {
        await route.fulfill({
          status: 500,
          json: { statusCode: 500 }
        })

        return
      }

      await route.fulfill({
        status: 201,

        json: {
          id: pendingItemId,
          status: 'pending'
        }
      })
    }
  }
}

function createRecoveringBrandsResponder() {
  let requestCount = 0
  let shouldSucceed = false

  return {
    allowSuccess: () => {
      shouldSucceed = true
    },

    getRequestCount: () => requestCount,

    respond: async (route: Route) => {
      requestCount += 1

      if (shouldSucceed) {
        await route.fulfill({ json: brands })

        return
      }

      await route.fulfill({
        status: 500,
        json: { statusCode: 500 }
      })
    }
  }
}

function createStaleCategoryResponder(staleRouteGate: Promise<void>) {
  return async (route: Route) => {
    const request = route.request()
    const { pathname } = new globalThis.URL(request.url())

    if (pathname.endsWith('/stoves')) {
      await staleRouteGate

      return
    }

    await route.fulfill({ json: sleepingPadsCategory })
  }
}

test.describe('Gear submissions', () => {
  test('should redirect an unauthenticated user to login with the submission return target', async ({ page }) => {
    await page.goto('/gear-library/new')

    const currentUrl = new globalThis.URL(page.url())

    expect(currentUrl.pathname).toBe('/login')
    expect(currentUrl.searchParams.get('redirectTo')).toBe('/gear-library/new')
  })

  test('should open the protected submission page from the Gear library CTA', async ({ context, page }) => {
    await mockGuestLogin(context)
    await mockCatalogApi(context)
    await openGearLibrary(page)

    const submitGearLink = page.getByRole('link', { name: 'Submit gear' })

    await expect(submitGearLink).toBeVisible()
    await submitGearLink.click()
    await expect(page).toHaveURL(/\/gear-library\/new$/u)
    await expect(page.getByRole('heading', { name: 'Submit missing gear' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Account required.' })).toBeVisible()

    await expect(page.getByText(
      'Guest accounts cannot submit gear for review. Account upgrade options will be available later.'
    )).toBeVisible()

    await expect(page.getByRole('link', { name: 'Back to Gear library' })).toBeVisible()
    await expect(page.locator('form')).toHaveCount(0)
  })

  test('should not load submission data or submit for a Guest', async ({ context, page }) => {
    const getSubmissionPageRequestCount = trackSubmissionPageRequests(page)

    await mockGuestLogin(context)
    await page.goto('/login?redirectTo=/gear-library/new')
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(/\/gear-library\/new$/u)
    await expect(page.getByRole('heading', { name: 'Account required.' })).toBeVisible()
    await expect(page.locator('form')).toHaveCount(0)
    expect(getSubmissionPageRequestCount()).toBe(0)
  })

  test('should recover mandatory references after retry', async ({ context, page }) => {
    const brandsResponder = createRecoveringBrandsResponder()

    await mockSubmissionApi(context)

    await context.route(
      (url) => url.pathname === '/api/equipment/brands',
      brandsResponder.respond
    )

    await openRegisteredSubmissionPage(context, page)

    const brandSelect = getSelect(page, 'Brand')
    const categorySelect = getSelect(page, 'Category')

    await expect(page.getByText('Could not load brands and categories.')).toBeVisible()
    await expect(brandSelect).toBeDisabled()
    await expect(categorySelect).toBeDisabled()

    const requestCountBeforeRetry = brandsResponder.getRequestCount()
    const brandRetryRequestPromise = page.waitForRequest(isBrandsRequest)

    brandsResponder.allowSuccess()
    await page.getByRole('button', { name: 'Retry' }).click()

    await brandRetryRequestPromise

    await expect(brandSelect).toBeEnabled()
    await expect(categorySelect).toBeEnabled()
    expect(brandsResponder.getRequestCount()).toBeGreaterThan(requestCountBeforeRetry)
    await fillBaseFields(page)
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeEnabled()
  })

  test('should require a valid HTTPS source URL before submitting and trim it in the request', async ({ context, page }) => {
    const requests: Request[] = []

    await mockSubmissionApi(context, {
      submit: async (route) => {
        requests.push(route.request())

        await route.fulfill({
          status: 201,

          json: {
            id: pendingItemId,
            status: 'pending'
          }
        })
      }
    })

    await openRegisteredSubmissionPage(context, page)

    const sourceInput = page.getByLabel('Source URL')
    const submitButton = page.getByRole('button', { name: 'Submit for review' })

    await expect(sourceInput).toHaveAttribute('required', '')
    await expect(sourceInput).toHaveAttribute('type', 'url')
    await expect(sourceInput).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Enter a source URL.')).toHaveCount(0)
    await fillBaseFields(page)
    await sourceInput.clear()
    await expect(submitButton).toBeDisabled()
    await expect(sourceInput).toHaveAttribute('aria-invalid', 'true')
    await expect(sourceInput).toHaveAccessibleDescription(/Enter a source URL\./u)
    await sourceInput.press('Enter')
    expect(requests).toHaveLength(0)
    await sourceInput.fill('http://example.com/product')
    await expect(submitButton).toBeDisabled()
    await expect(sourceInput).toHaveAccessibleDescription(/Enter a valid HTTPS URL\./u)
    await sourceInput.press('Enter')
    expect(requests).toHaveLength(0)
    await sourceInput.fill('https:example.com')
    await expect(submitButton).toBeDisabled()
    await expect(sourceInput).toHaveAccessibleDescription(/Enter a valid HTTPS URL\./u)
    await sourceInput.fill('https:/example.com')
    await expect(submitButton).toBeDisabled()
    await expect(sourceInput).toHaveAccessibleDescription(/Enter a valid HTTPS URL\./u)
    await sourceInput.fill('https://')
    await expect(submitButton).toBeDisabled()
    await expect(sourceInput).toHaveAccessibleDescription(/Enter a valid HTTPS URL\./u)
    await sourceInput.fill('not a URL')
    await expect(submitButton).toBeDisabled()
    await expect(sourceInput).toHaveAccessibleDescription(/Enter a valid HTTPS URL\./u)
    await sourceInput.fill(`  ${sourceUrl}  `)
    await expect(sourceInput).not.toHaveAttribute('aria-invalid', 'true')
    await expect(submitButton).toBeEnabled()
    await submitButton.click()
    await expect(page.getByRole('status')).toContainText('Submitted for review.')
    expect(requests).toHaveLength(1)
    expect(requests[0]?.postDataJSON()).toMatchObject({ sourceUrl })
  })

  test('should preserve pasted source URLs and validate their trimmed length', async ({ context, page }) => {
    await mockSubmissionApi(context)
    await openRegisteredSubmissionPage(context, page)
    await fillBaseFields(page)

    const sourceInput = page.getByLabel('Source URL')
    const submitButton = page.getByRole('button', { name: 'Submit for review' })
    const prefix = 'https://shop.example/'
    const sourceAtLimit = `${prefix}${'a'.repeat(2048 - prefix.length)}`
    const overlongSource = `${sourceAtLimit}b`
    const paddedSource = `  ${sourceAtLimit}  `

    await sourceInput.clear()
    await sourceInput.focus()
    await page.keyboard.insertText(overlongSource)
    await expect(sourceInput).toHaveValue(overlongSource)
    await expect(sourceInput).toHaveAccessibleDescription(/Use a source URL with 2,048 characters or fewer\./u)
    await expect(submitButton).toBeDisabled()
    await sourceInput.clear()
    await page.keyboard.insertText(paddedSource)
    await expect(sourceInput).toHaveValue(paddedSource)
    await expect(sourceInput).not.toHaveAttribute('aria-invalid', 'true')
    await expect(submitButton).toBeEnabled()

    const requestPromise = page.waitForRequest(isSubmissionRequest)

    await submitButton.click()

    const request = await requestPromise

    expect(request.postDataJSON()).toMatchObject({ sourceUrl: sourceAtLimit })
    await expect(page.getByRole('status')).toContainText('Submitted for review.')
  })

  test('should preserve the source URL when changing category', async ({ context, page }) => {
    await mockSubmissionApi(context)
    await openRegisteredSubmissionPage(context, page)
    await fillBaseFields(page)
    await page.getByLabel('Weight').fill('83.5')
    await selectPerdOption(getSelect(page, 'Category'), 'sleeping-pads')

    await page.getByRole('button', {
      name: 'Change category',
      exact: true
    }).click()

    await expect(page.getByLabel('R-value')).toBeVisible()
    await expect(page.getByLabel('Source URL')).toHaveValue(sourceUrl)
  })

  test('should submit exact typed properties and replace the form with confirmation', async ({
    context,
    page
  }) => {
    const getMyGearPostCount = trackMyGearPosts(page)

    await mockSubmissionApi(context)
    await openRegisteredSubmissionPage(context, page)
    await expect(page.getByLabel('Item name')).toHaveAttribute('required', '')
    await expect(getSelect(page, 'Brand')).toHaveAttribute('aria-required', 'true')
    await expect(getSelect(page, 'Category')).toHaveAttribute('aria-required', 'true')
    await fillBaseFields(page)
    await page.getByLabel('Weight').fill('83.5')
    await page.getByLabel('Notes').fill('  Three season  ')
    await selectPerdOption(getSelect(page, 'Fuel type'), 'canister')

    const booleanSelect = getSelect(page, 'Piezo ignition')

    await expect(booleanSelect).toHaveAttribute('data-value', '')
    await selectPerdOption(booleanSelect, 'false')

    const submissionRequestPromise = page.waitForRequest(isSubmissionRequest)

    await page.getByRole('button', { name: 'Submit for review' }).click()

    const submissionRequest = await submissionRequestPromise
    const requestBody: unknown = submissionRequest.postDataJSON()

    expect(requestBody).toStrictEqual({
      brandId: 10,
      categoryId: 2,
      name: 'PocketRocket Deluxe',
      sourceUrl,

      properties: [{
        propertyId: 21,
        value: '83.5'
      }, {
        propertyId: 24,
        value: 'Three season'
      }, {
        propertyId: 23,
        value: 'canister'
      }, {
        propertyId: 22,
        value: false
      }]
    })

    const submissionStatus = page.getByRole('status')

    await expect(submissionStatus).toContainText('Submitted for review.')
    await expect(submissionStatus).toBeFocused()
    await expect(page.getByRole('button', { name: 'Submit for review' })).toHaveCount(0)
    await expect(page.locator(`a[href*="${pendingItemId}"]`)).toHaveCount(0)

    await expect(page.getByRole('link', { name: 'View My contributions' })).toHaveAttribute(
      'href',
      '/account/submissions'
    )

    expect(getMyGearPostCount()).toBe(0)
  })

  test('should preserve the form after a failed submit and allow retry', async ({ context, page }) => {
    const submitResponder = createRetryingSubmitResponder()

    await mockSubmissionApi(context, {
      submit: submitResponder.respond
    })

    await openRegisteredSubmissionPage(context, page)
    await fillBaseFields(page)
    await page.getByLabel('Weight').fill('83.5')
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByText('Could not submit item. Try again.')).toBeVisible()
    await expect(page.getByLabel('Item name')).toHaveValue('PocketRocket Deluxe')
    await expect(page.getByLabel('Weight')).toHaveValue('83.5')
    await expect(page.getByLabel('Source URL')).toHaveValue(sourceUrl)
    await page.getByRole('button', { name: 'Submit for review' }).click()
    await expect(page.getByRole('status')).toContainText('Submitted for review.')
    expect(submitResponder.getRequestCount()).toBe(2)
  })

  test('should explain rate limiting while preserving and re-enabling the form', async ({
    context,
    page
  }) => {
    const responseGate = createDeferred()

    await mockSubmissionApi(context, {
      submit: async (route) => {
        await responseGate.promise

        await route.fulfill({
          status: 429,

          json: {
            statusCode: 429,
            statusMessage: 'Too many item submission attempts'
          }
        })
      }
    })

    await openRegisteredSubmissionPage(context, page)
    await fillBaseFields(page)
    await page.getByLabel('Weight').fill('83.5')

    const submitButton = page.getByRole('button', { name: 'Submit for review' })
    const submissionRequestPromise = page.waitForRequest(isSubmissionRequest)

    await submitButton.click()

    await submissionRequestPromise

    await expect(submitButton).toBeDisabled()
    responseGate.resolve()

    await expect(page.getByRole('alert')).toHaveText(
      'Too many item submission attempts. Try again in a minute.'
    )

    await expect(page.getByLabel('Item name')).toHaveValue('PocketRocket Deluxe')
    await expect(page.getByLabel('Weight')).toHaveValue('83.5')
    await expect(page.getByLabel('Source URL')).toHaveValue(sourceUrl)
    await expect(page.getByLabel('Item name')).toBeEnabled()
    await expect(page.getByLabel('Source URL')).toBeEnabled()
    await expect(submitButton).toBeEnabled()
  })

  test('should reset the form and allow another submission after success', async ({ context, page }) => {
    await mockSubmissionApi(context)
    await openRegisteredSubmissionPage(context, page)
    await fillBaseFields(page)
    await page.getByLabel('Weight').fill('83.5')

    const firstSubmissionRequestPromise = page.waitForRequest(isSubmissionRequest)

    await page.getByRole('button', { name: 'Submit for review' }).click()

    await firstSubmissionRequestPromise

    await expect(page.getByRole('status')).toContainText('Submitted for review.')
    await page.getByRole('button', { name: 'Submit another item' }).click()
    await expect(page.getByLabel('Item name')).toHaveValue('')
    await expect(page.getByLabel('Source URL')).toHaveValue('')
    await expect(page.getByLabel('Source URL')).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Item name')).toBeFocused()
    await expect(getSelect(page, 'Brand')).toHaveAttribute('data-value', '')
    await expect(getSelect(page, 'Category')).toHaveAttribute('data-value', '')
    await expect(page.getByLabel('Weight')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Submit for review' })).toBeDisabled()
    await fillBaseFields(page)
    await page.getByLabel('Item name').fill('PocketRocket 2')
    await expect(page.getByLabel('Weight')).toHaveValue('')

    const secondSubmissionRequestPromise = page.waitForRequest(isSubmissionRequest)

    await page.getByRole('button', { name: 'Submit for review' }).click()

    const secondSubmissionRequest = await secondSubmissionRequestPromise
    const secondRequestBody: unknown = secondSubmissionRequest.postDataJSON()

    expect(secondRequestBody).toStrictEqual({
      brandId: 10,
      categoryId: 2,
      name: 'PocketRocket 2',
      sourceUrl,
      properties: []
    })

    await expect(page.getByRole('status')).toContainText('Submitted for review.')
  })

  test('should retry failed category details but allow a base-only submission', async ({
    context,
    page
  }) => {
    let categoryRequestCount = 0

    await mockSubmissionApi(context, {
      categoryDetail: async (route) => {
        categoryRequestCount += 1

        await route.fulfill({
          status: 500,
          json: { statusCode: 500 }
        })
      }
    })

    await openRegisteredSubmissionPage(context, page)
    await fillBaseFields(page)
    await expect(page.getByText(/Could not load characteristics/u)).toBeVisible()

    const categoryRequestCountBeforeRetry = categoryRequestCount

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => categoryRequestCount).toBeGreaterThan(categoryRequestCountBeforeRetry)

    const submissionRequestPromise = page.waitForRequest(isSubmissionRequest)

    await page.getByRole('button', { name: 'Submit for review' }).click()

    const submissionRequest = await submissionRequestPromise
    const requestBody: unknown = submissionRequest.postDataJSON()

    expect(requestBody).toStrictEqual({
      brandId: 10,
      categoryId: 2,
      name: 'PocketRocket Deluxe',
      sourceUrl,
      properties: []
    })
  })

  test('should abort stale category details and show only the latest category fields', async ({
    context,
    page
  }) => {
    const staleRouteGate = createDeferred()

    await mockSubmissionApi(context, {
      categoryDetail: createStaleCategoryResponder(staleRouteGate.promise)
    })

    await openRegisteredSubmissionPage(context, page)

    const staleRequestFailedPromise = page.waitForEvent(
      'requestfailed',
      (request) => request.url().endsWith('/api/equipment/categories/by-slug/stoves')
    )

    await selectPerdOption(getSelect(page, 'Category'), 'stoves')
    await selectPerdOption(getSelect(page, 'Category'), 'sleeping-pads')

    const staleRequest = await staleRequestFailedPromise

    expect(staleRequest.failure()?.errorText).toContain('ERR_ABORTED')
    staleRouteGate.resolve()
    await expect(page.getByLabel('R-value')).toBeVisible()
    await expect(page.getByLabel('Weight')).toHaveCount(0)
  })
})
