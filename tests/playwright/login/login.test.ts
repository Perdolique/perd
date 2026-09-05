import type { Page, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

const brandsApiRoute = '**/api/equipment/brands'
const buildCommitSha = 'abc1234567890abcdef1234567890abcdef12345'
const buildCommitShortSha = buildCommitSha.slice(0, 7)
const repositoryUrl = 'https://github.com/Perdolique/perd'
const buildCommitUrl = `${repositoryUrl}/commit/${buildCommitSha}`

const guestErrorScenarios = [
  {
    message: 'Security check failed. Try again.',
    status: 403
  },
  {
    message: 'Too many Guest attempts. Try again in a minute.',
    status: 429
  },
  {
    message: 'Guest access is temporarily unavailable. Try again.',
    status: 503
  },
  {
    message: 'Could not continue as Guest. Try again.',
    status: 500
  }
] as const

async function continueRoute(route: Route) {
  await route.continue()
}

async function getClientUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const getNuxtApp: unknown = Reflect.get(globalThis, 'useNuxtApp')

    if (typeof getNuxtApp !== 'function') {
      throw new TypeError('Nuxt app accessor is unavailable')
    }

    const nuxtApp: unknown = Reflect.apply(getNuxtApp, globalThis, [])

    if (nuxtApp === null || typeof nuxtApp !== 'object') {
      throw new TypeError('Nuxt app is unavailable')
    }

    const payload: unknown = Reflect.get(nuxtApp, 'payload')

    if (payload === null || typeof payload !== 'object') {
      throw new TypeError('Nuxt payload is unavailable')
    }

    const state: unknown = Reflect.get(payload, 'state')

    if (state === null || typeof state !== 'object') {
      throw new TypeError('Nuxt state is unavailable')
    }

    const user: unknown = Reflect.get(state, '$suser')

    if (user === null || typeof user !== 'object') {
      throw new TypeError('Nuxt user state is unavailable')
    }

    const userId: unknown = Reflect.get(user, 'userId')

    return typeof userId === 'string' ? userId : null
  })
}

async function captureAndFulfillRetriedGuestSession(
  route: Route,
  requestBodies: unknown[]
): Promise<void> {
  const body: unknown = route.request().postDataJSON()

  requestBodies.push(body)

  if (requestBodies.length === 1) {
    await route.fulfill({
      json: { statusCode: 403 },
      status: 403
    })

    return
  }

  await route.fulfill({
    status: 201,

    json: {
      isGuest: true,
      userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
    }
  })
}

test.describe('Login page', () => {
  test('should render an interaction-only security check and secondary Guest action', async ({
    page,
    turnstile
  }) => {
    await page.goto('/login')

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await expect(guestButton).toBeEnabled()
    await expect(guestButton).toHaveClass(/secondary/u)
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeVisible()
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0)

    const renderOptions = await turnstile.getRenderOptions(page)

    expect(renderOptions).toStrictEqual([{
      action: 'guest_session',
      appearance: 'interaction-only',
      responseField: false,
      sitekey: '1x00000000000000000000AA',
      size: 'flexible'
    }])

    const githubLink = page.getByRole('link', {
      name: 'GitHub',
      exact: true
    })

    const commitLink = page.getByRole('link', {
      name: `#${buildCommitShortSha}`,
      exact: true
    })

    await expect(githubLink).toBeVisible()
    await expect(githubLink).toHaveAttribute('href', repositoryUrl)
    await expect(githubLink).toHaveAttribute('target', '_blank')
    await expect(githubLink).toHaveAttribute('rel', 'noreferrer')

    await expect(page.locator('footer')).toContainText(`Commit #${buildCommitShortSha}`)
    await expect(commitLink).toBeVisible()
    await expect(commitLink).toHaveAttribute('href', buildCommitUrl)
    await expect(commitLink).toHaveAttribute('target', '_blank')
    await expect(commitLink).toHaveAttribute('rel', 'noreferrer')
  })

  test('should enable Guest only after Turnstile returns a token', async ({ page, turnstile }) => {
    await turnstile.pause(page)
    await page.goto('/login')

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await expect(guestButton).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeEnabled()

    await turnstile.complete(page)

    await expect(guestButton).toBeEnabled()
  })

  test('should disable Guest when the Turnstile token expires', async ({ page, turnstile }) => {
    await page.goto('/login')

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await expect(guestButton).toBeEnabled()
    await turnstile.expire(page)
    await expect(guestButton).toBeDisabled()

    await turnstile.complete(page)
    await expect(guestButton).toBeEnabled()
  })

  test('should fail safely when the Turnstile script cannot load', async ({ page, turnstile }) => {
    await turnstile.failScriptLoad(page)
    await page.goto('/login')

    await expect(page.getByRole('alert')).toHaveText(
      'Security check is unavailable. Refresh the page and try again.'
    )

    await expect(page.getByRole('button', { name: 'Guest' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeEnabled()
  })

  test('should return to the api document after guest login', async ({ page }) => {
    let guestRequestBody: unknown = null

    await page.route(brandsApiRoute, continueRoute)
    await page.goto('/api/equipment/brands')
    await page.unroute(brandsApiRoute, continueRoute)

    await expect(page).toHaveURL(/\/login\?redirectTo=\/api\/equipment\/brands$/u)

    await page.route('**/api/auth/create-session', async (route) => {
      guestRequestBody = route.request().postDataJSON()

      await route.fulfill({
        status: 201,

        json: {
          isGuest: true,
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }
      })
    })

    await page.route(brandsApiRoute, async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)
    await expect(page.locator('body')).toHaveText('[]')

    expect(guestRequestBody).toStrictEqual({
      'cf-turnstile-response': 'turnstile-token-1'
    })
  })

  test('should carry Guest user state into the original app destination', async ({ page }) => {
    const responseUserId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

    await page.route('**/api/auth/create-session', async (route) => {
      await route.fulfill({
        status: 201,

        json: {
          isGuest: true,
          userId: responseUserId
        }
      })
    })

    await page.goto('/login?redirectTo=/gear-library/new')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/gear-library\/new$/u)
    await expect(page.getByText('Guest accounts cannot submit gear for review.')).toBeVisible()
    await expect.poll(async () => getClientUserId(page)).toBe(responseUserId)
  })

  for (const { message, status } of guestErrorScenarios) {
    test(`should show the safe Guest error for ${status}`, async ({ page }) => {
      await page.route('**/api/auth/create-session', async (route) => {
        await route.fulfill({
          json: { statusCode: status },
          status
        })
      })

      await page.goto('/login')

      const guestButton = page.getByRole('button', { name: 'Guest' })

      await guestButton.click()

      await expect(page.getByRole('alert')).toHaveText(message)
      await expect(guestButton).toBeEnabled()
    })
  }

  test('should submit a fresh token when retrying after an error', async ({ page, turnstile }) => {
    const requestBodies: unknown[] = []

    await page.route('**/api/auth/create-session', async (route) => {
      await captureAndFulfillRetriedGuestSession(route, requestBodies)
    })

    await turnstile.pause(page)
    await page.goto('/login?redirectTo=/gear-library/new')

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await turnstile.complete(page)
    await expect(guestButton).toBeEnabled()
    await guestButton.click()
    await expect(page.getByRole('alert')).toHaveText('Security check failed. Try again.')
    await expect(guestButton).toBeDisabled()

    await turnstile.complete(page)
    await expect(guestButton).toBeEnabled()
    await guestButton.click()

    await expect(page).toHaveURL(/\/gear-library\/new$/u)

    expect(requestBodies).toStrictEqual([
      {
        'cf-turnstile-response': 'turnstile-token-1'
      },
      {
        'cf-turnstile-response': 'turnstile-token-2'
      }
    ])
  })

  test('should start twitch oauth without a Turnstile token', async ({ page, turnstile }) => {
    await page.route('**/api/oauth/twitch**', async (route) => {
      await route.fulfill({
        contentType: 'text/plain',
        body: 'oauth start'
      })
    })

    await turnstile.pause(page)

    const twitchRequestPromise = page.waitForRequest((request) => {
      const requestUrl = new globalThis.URL(request.url())

      return requestUrl.pathname === '/api/oauth/twitch'
    })

    await page.goto('/login?redirectTo=/')
    await expect(page.getByRole('button', { name: 'Guest' })).toBeDisabled()
    await page.getByRole('button', { name: 'Twitch' }).click()

    const twitchRequest = await twitchRequestPromise
    const twitchRequestUrl = new globalThis.URL(twitchRequest.url())

    expect(twitchRequest.method()).toBe('GET')
    expect(twitchRequestUrl.searchParams.get('redirectTo')).toBe('/')

    await expect.poll(() => {
      const currentUrl = new globalThis.URL(page.url())

      return {
        pathname: currentUrl.pathname,
        redirectTo: currentUrl.searchParams.get('redirectTo')
      }
    }).toStrictEqual({
      pathname: '/api/oauth/twitch',
      redirectTo: '/'
    })

    await expect(page.locator('body')).toHaveText('oauth start')
  })

  test('should restore api redirects after the twitch callback', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      await route.fulfill({
        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          isAdmin: false,
          isGuest: false
        }
      })
    })

    await page.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.goto('/auth/twitch?code=oauth-code&state=%2Fapi%2Fequipment%2Fbrands')

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)
    await expect(page.locator('body')).toHaveText('[]')
  })
})
