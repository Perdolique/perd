import { test, expect } from '../fixtures/global.fixtures'

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

    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('404')
    await expect(page).toHaveURL(/\/missing-page-for-routing-test$/u)
    await page.waitForFunction(isPageHydrated)
    await page.getByRole('button', { name: 'Go back home' }).click()
    await expect(page).toHaveURL(/\/login\?redirectTo=\/$/u)

    await expect(page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })).toBeVisible()
  })

  test('returns HTML 404 for a missing page before guest authentication', async ({ request }) => {
    const response = await request.get('/missing-page-for-routing-test?search=tent', {
      headers: { accept: 'text/html' },
      maxRedirects: 0
    })

    expect(response.status()).toBe(404)
    expect(response.headers()['content-type']).toContain('text/html')
    expect(response.headers().location).toBeUndefined()

    const html = await response.text()

    expect(html).toContain('Page not found.')
    expect(html).toContain('Go back home')
  })

  test('returns JSON 404 for a missing non-HTML page request', async ({ request }) => {
    const response = await request.get('/missing-page-for-routing-test', {
      headers: { accept: 'application/json' },
      maxRedirects: 0
    })

    expect(response.status()).toBe(404)
    expect(response.headers()['content-type']).toContain('application/json')
    expect(response.headers().location).toBeUndefined()
    expect(await response.json()).toMatchObject({ statusCode: 404 })
  })

  test('preserves the login redirect and query for an existing protected page', async ({ request }) => {
    const response = await request.get('/gear-library?search=tent', {
      headers: { accept: 'text/html' },
      maxRedirects: 0
    })

    expect(response.status()).toBe(302)
    expect(response.headers().location).toBe('/login?redirectTo=/gear-library?search=tent')
  })

  test('preserves protected API document redirects and programmatic 401 responses', async ({ request }) => {
    const document = await request.get('/api/equipment/brands?search=tent', {
      headers: {
        accept: 'text/html',
        'sec-fetch-dest': 'document'
      },

      maxRedirects: 0
    })

    expect(document.status()).toBe(302)
    expect(document.headers().location).toBe('/login?redirectTo=%2Fapi%2Fequipment%2Fbrands%3Fsearch%3Dtent')

    const programmatic = await request.get('/api/equipment/brands?search=tent', {
      headers: { accept: 'application/json' },
      maxRedirects: 0
    })

    expect(programmatic.status()).toBe(401)
    expect(programmatic.headers().location).toBeUndefined()
    expect(await programmatic.json()).toMatchObject({ statusCode: 401 })
  })
})
