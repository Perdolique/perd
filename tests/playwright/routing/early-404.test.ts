import * as v from 'valibot'
import { test, expect } from '../fixtures/global.fixtures'

const errorResponseSchema = v.object({ statusCode: v.number() })

function isPageHydrated(): boolean {
  let value: unknown = globalThis.document.querySelector('#__nuxt')

  for (const key of ['__vue_app__', 'config', 'globalProperties', '$nuxt', 'isHydrating']) {
    if (value === null || typeof value !== 'object') {
      return false
    }

    value = Reflect.get(value, key)
  }

  return value === false
}

test.describe('early page 404 responses', () => {
  test('keeps the error page visible and requires sign-in when returning home', async ({ context, page }) => {
    await context.route('**/api/user', async (route) => {
      await route.fulfill({ json: { userId: null } })
    })

    const response = await page.goto('/missing-page-for-routing-test')
    const status = response?.status()

    expect(status).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404')
    await expect(page).toHaveURL(/\/missing-page-for-routing-test$/u)
    await page.waitForFunction(isPageHydrated)

    const returnHomeButton = page.getByRole('button', { name: 'Go back home' })

    await returnHomeButton.focus()
    await returnHomeButton.press('Enter')
    await expect(page).toHaveURL(/\/login\?redirectTo=\/$/u)

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Sign in'
    })).toBeFocused()

    await expect(page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })).toBeVisible()
  })

  test('restores the signed-in user before returning home from an early 404', async ({ context, page }) => {
    let userRequests = 0

    await context.route('**/api/user', async (route) => {
      userRequests += 1

      await route.fulfill({ json: {
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
        email: 'routing-test@example.com',
        isAdmin: false,
        isGuest: false,
        isTwitchLinked: false
      } })
    })

    await page.goto('/missing-page-for-routing-test')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404')
    await page.waitForFunction(isPageHydrated)
    expect(userRequests).toBe(0)

    const returnHomeButton = page.getByRole('button', { name: 'Go back home' })

    await returnHomeButton.focus()
    await returnHomeButton.press('Enter')
    await expect(page).toHaveURL('/')

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Home'
    })).toBeVisible()

    expect(userRequests).toBe(1)

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Home'
    })).toBeFocused()
  })

  test('returns HTML 404 for a missing page before guest authentication', async ({ request }) => {
    const response = await request.get('/missing-page-for-routing-test?search=tent', {
      headers: { accept: 'text/html' },
      maxRedirects: 0
    })

    const status = response.status()
    const headers = response.headers()

    expect(status).toBe(404)
    expect(headers['content-type']).toContain('text/html')
    expect(headers.location).toBeUndefined()

    const html = await response.text()

    expect(html).toContain('Page not found.')
    expect(html).toContain('Go back home')
  })

  test('returns JSON 404 for a missing non-HTML page request', async ({ request }) => {
    const response = await request.get('/missing-page-for-routing-test', {
      headers: { accept: 'application/json' },
      maxRedirects: 0
    })

    const status = response.status()
    const headers = response.headers()
    const rawBody: unknown = await response.json()
    const body = v.parse(errorResponseSchema, rawBody)

    expect(status).toBe(404)
    expect(headers['content-type']).toContain('application/json')
    expect(headers.location).toBeUndefined()
    expect(body.statusCode).toBe(404)
  })

  test('preserves the login redirect and query for an existing protected page', async ({ request }) => {
    const response = await request.get('/gear-library?search=tent', {
      headers: { accept: 'text/html' },
      maxRedirects: 0
    })

    const status = response.status()
    const headers = response.headers()

    expect(status).toBe(302)
    expect(headers.location).toBe('/login?redirectTo=/gear-library?search=tent')
  })

  test('preserves protected API document redirects and programmatic 401 responses', async ({ request }) => {
    const document = await request.get('/api/equipment/brands?search=tent', {
      headers: {
        accept: 'text/html',
        'sec-fetch-dest': 'document'
      },

      maxRedirects: 0
    })

    const documentStatus = document.status()
    const documentHeaders = document.headers()

    expect(documentStatus).toBe(302)
    expect(documentHeaders.location).toBe('/login?redirectTo=%2Fapi%2Fequipment%2Fbrands%3Fsearch%3Dtent')

    const programmatic = await request.get('/api/equipment/brands?search=tent', {
      headers: { accept: 'application/json' },
      maxRedirects: 0
    })

    const programmaticStatus = programmatic.status()
    const programmaticHeaders = programmatic.headers()
    const rawBody: unknown = await programmatic.json()
    const body = v.parse(errorResponseSchema, rawBody)

    expect(programmaticStatus).toBe(401)
    expect(programmaticHeaders.location).toBeUndefined()
    expect(body.statusCode).toBe(401)
  })
})
