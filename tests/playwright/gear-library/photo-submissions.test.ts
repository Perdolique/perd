import type { BrowserContext, Page, Request } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const submissionId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const itemPath = `/gear-library/${itemId}`
const submissionPath = `${itemPath}/submit-photo`
const photoApiPath = `/api/equipment/items/${itemId}/photo-submissions`
const sourceUrl = 'https://www.msrgear.com/products/pocketrocket'
const photoFixturePath = 'tests/playwright/fixtures/photo-submission.webp'

interface MultipartPart {
  data: string;
  filename?: string;
  name: string;
  type?: string;
}

const item = {
  brand: {
    id: 1,
    name: 'MSR',
    slug: 'msr'
  },
  category: {
    id: 2,
    name: 'Stoves',
    slug: 'stoves'
  },
  cloudflareImageId: null,
  createdAt: '2026-04-01T09:00:00.000Z',
  id: itemId,
  isInMyGear: false,
  name: 'PocketRocket Deluxe',
  properties: []
} as const

async function mockItem(context: BrowserContext) {
  await context.route((url) => url.pathname === `/api/equipment/items/${itemId}`, async (route) => {
    await route.fulfill({ json: item })
  })
}

async function authenticateRegisteredUser(
  context: BrowserContext,
  page: Page,
  target: string
) {
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

function isPhotoSubmissionRequest(request: Request) {
  const requestUrl = new globalThis.URL(request.url())

  return requestUrl.pathname === photoApiPath && request.method() === 'POST'
}

function parseMultipartRequest(request: Request): MultipartPart[] {
  const contentType = request.headers()['content-type']
  const body = request.postData()

  if (body === null) {
    throw new Error('Expected a multipart request body')
  }

  const boundaryMatch = /boundary=(?<boundary>[^;]+)/u.exec(contentType)
  const boundary = boundaryMatch?.groups?.boundary

  if (boundary === undefined) {
    throw new Error('Expected a multipart boundary')
  }

  const parts: MultipartPart[] = []

  for (const rawPart of body.split(`--${boundary}`)) {
    const normalizedPart = rawPart.replaceAll(/^\r\n|\r\n$/gu, '')

    if (normalizedPart !== '' && normalizedPart !== '--') {
      const [headers = '', ...dataParts] = normalizedPart.split('\r\n\r\n')
      const name = /name="(?<name>[^"]+)"/u.exec(headers)?.groups?.name

      if (name === undefined) {
        throw new Error('Expected a multipart field name')
      }

      parts.push({
        data: dataParts.join('\r\n\r\n'),
        filename: /filename="(?<filename>[^"]+)"/u.exec(headers)?.groups?.filename,
        name,
        type: /Content-Type:\s*(?<type>[^\r\n]+)/iu.exec(headers)?.groups?.type
      })
    }
  }

  return parts
}

function getMultipartPart(parts: MultipartPart[], name: string): MultipartPart {
  const part = parts.find((candidate) => candidate.name === name)

  if (part === undefined) {
    throw new Error(`Expected multipart field ${name}`)
  }

  return part
}

async function setOversizedPhoto(page: Page): Promise<void> {
  await page.getByLabel('Photo', { exact: true }).evaluate((element) => {
    if ((element instanceof globalThis.HTMLInputElement) === false) {
      throw new TypeError('Expected a photo input')
    }

    const photo = new globalThis.File(
      [new globalThis.Uint8Array(5_000_001)],
      'oversized.webp',
      { type: 'image/webp' }
    )
    const files = new globalThis.DataTransfer()

    files.items.add(photo)
    element.files = files.files
    element.dispatchEvent(new globalThis.Event('change', { bubbles: true }))
  })
}

test.describe('Photo submissions', () => {
  test('should open the dedicated form from an item and deny a Guest', async ({ context, page }) => {
    await context.route((url) => url.pathname === '/api/auth/create-session', async (route) => {
      await route.fulfill({
        status: 201,
        json: {
          isGuest: true,
          userId
        }
      })
    })
    await mockItem(context)

    await page.goto(`/login?redirectTo=${encodeURIComponent(itemPath)}`)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(new RegExp(`${itemPath}$`, 'u'))
    await page.getByRole('link', { name: 'Submit photo' }).click()

    await expect(page).toHaveURL(new RegExp(`${submissionPath}$`, 'u'))
    await expect(page.getByRole('heading', { level: 1, name: 'Submit a photo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Account required.' })).toBeVisible()
    await expect(page.locator('form')).toHaveCount(0)
  })

  test('should upload one manufacturer photo with exact private submission metadata', async ({
    context,
    page
  }) => {
    const responseGate = createDeferred()

    await mockItem(context)
    await context.route((url) => url.pathname === photoApiPath, async (route) => {
      await responseGate.promise

      await route.fulfill({
        status: 201,
        json: { id: submissionId, status: 'pending' }
      })
    })
    await authenticateRegisteredUser(context, page, itemPath)
    await page.getByRole('link', { name: 'Submit photo' }).click()

    const manufacturerSource = page.getByRole('radio', {
      name: 'Official manufacturer photo'
    })

    await manufacturerSource.check()
    const sourceInput = page.getByLabel('Manufacturer source')

    await expect(sourceInput).toBeVisible()
    await expect(sourceInput).toHaveAttribute('required', '')
    await sourceInput.fill(sourceUrl)
    const photoInput = page.getByLabel('Photo', { exact: true })

    await expect(photoInput).not.toHaveAttribute('multiple', '')
    await photoInput.setInputFiles(photoFixturePath)
    await expect(page.getByText('Selected: photo-submission.webp')).toBeVisible()
    const rightsCheckbox = page.getByLabel(
      'I confirm that this photo can be published in the catalog.'
    )

    await rightsCheckbox.check()

    const submissionRequestPromise = page.waitForRequest(isPhotoSubmissionRequest)

    await page.getByRole('button', { name: 'Submit photo' }).click()

    const submissionRequest = await submissionRequestPromise
    const requestUrl = new globalThis.URL(submissionRequest.url())
    const submissionParts = parseMultipartRequest(submissionRequest)
    const submittedPhoto = getMultipartPart(submissionParts, 'photo')

    expect(Object.fromEntries(requestUrl.searchParams)).toStrictEqual({})
    expect(submissionRequest.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/u)
    expect(getMultipartPart(submissionParts, 'rightsConfirmed').data).toBe('true')
    expect(getMultipartPart(submissionParts, 'sourceType').data).toBe('manufacturer')
    expect(getMultipartPart(submissionParts, 'sourceUrl').data).toBe(sourceUrl)
    expect(submittedPhoto.filename).toBe('photo-submission.webp')
    expect(submittedPhoto.type).toBe('image/webp')
    expect(submittedPhoto.data).toMatch(/^RIFF/u)

    const submitButton = page.getByRole('button', { name: 'Submit photo' })

    await expect(submitButton).toBeDisabled()
    await expect(submitButton).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByLabel('Photo', { exact: true })).toBeDisabled()
    await expect(manufacturerSource).toBeDisabled()
    await expect(sourceInput).toBeDisabled()
    await expect(rightsCheckbox).toBeDisabled()
    responseGate.resolve()

    const status = page.getByRole('status')

    await expect(status).toContainText('remain private until an administrator approves it')
    await expect(status).toBeFocused()
    await expect(page.locator('form')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Back to item' })).toHaveAttribute('href', itemPath)
    await expect(page.getByRole('link', { name: 'View My contributions' })).toHaveAttribute(
      'href',
      '/account/submissions'
    )
  })

  test('should block an oversized file and non-HTTPS manufacturer URL before POST', async ({
    context,
    page
  }) => {
    let requestCount = 0

    await mockItem(context)
    await context.route((url) => url.pathname === photoApiPath, async (route) => {
      requestCount += 1
      await route.fulfill({ status: 201, json: { id: submissionId, status: 'pending' } })
    })
    await authenticateRegisteredUser(context, page, submissionPath)
    await page.getByRole('radio', { name: 'Official manufacturer photo' }).check()
    await page.getByLabel('Manufacturer source').fill('http://manufacturer.example/product')
    await setOversizedPhoto(page)
    await page.getByLabel('I confirm that this photo can be published in the catalog.').check()

    await expect(page.getByText('Choose a photo that is 5 MB or smaller.')).toBeVisible()
    await expect(page.getByText('Use an HTTPS manufacturer URL.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit photo' })).toBeDisabled()
    await page.locator('form').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
    })
    expect(requestCount).toBe(0)
  })

  for (const { message, status } of [
    {
      message: 'Choose a photo that is 5 MB or smaller.',
      status: 413
    },
    {
      message: 'Choose a valid JPEG, PNG, or WebP image.',
      status: 415
    }
  ] as const) {
    test(`should show the safe ${status} upload error`, async ({ context, page }) => {
      await mockItem(context)
      await context.route((url) => url.pathname === photoApiPath, async (route) => {
        await route.fulfill({ status, json: { statusMessage: 'Internal upload detail' } })
      })
      await authenticateRegisteredUser(context, page, submissionPath)
      await page.getByLabel('Photo', { exact: true }).setInputFiles(photoFixturePath)
      await page.getByLabel('I confirm that this photo can be published in the catalog.').check()
      await page.getByRole('button', { name: 'Submit photo' }).click()

      await expect(page.getByRole('alert')).toHaveText(message)
      await expect(page.getByText('Internal upload detail')).toHaveCount(0)
    })
  }

  test('should show the pending photo in My contributions without a preview', async ({
    context,
    page
  }) => {
    await context.route((url) => url.pathname === '/api/user/item-submissions', async (route) => {
      await route.fulfill({ json: { items: [] } })
    })
    await context.route((url) => url.pathname === '/api/user/photo-submissions', async (route) => {
      await route.fulfill({
        json: {
          items: [{
            createdAt: '2026-08-10T12:00:00.000Z',
            filename: 'PocketRocket official.webp',
            id: submissionId,
            item: {
              id: itemId,
              name: item.name
            },
            sourceType: 'manufacturer',
            sourceUrl,
            status: 'pending',
            updatedAt: '2026-08-10T12:00:00.000Z'
          }]
        }
      })
    })
    await authenticateRegisteredUser(context, page, '/account/submissions')

    const photoSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Photo submissions' })
    })

    await expect(photoSection.getByRole('link', { name: item.name })).toHaveAttribute('href', itemPath)
    await expect(photoSection.getByText('PocketRocket official.webp')).toBeVisible()
    await expect(photoSection.getByText('Official manufacturer photo')).toBeVisible()
    await expect(photoSection.getByText('Pending', { exact: true })).toBeVisible()
    await expect(photoSection.getByRole('link', { name: 'Manufacturer source' })).toHaveAttribute(
      'href',
      sourceUrl
    )
    await expect(photoSection.locator('img')).toHaveCount(0)
    await expect(photoSection).not.toContainText('cloudflare')
  })
})
