import type { Page, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

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

async function navigateWithinApp(page: Page, path: string) {
  await page.evaluate(async (destination) => {
    const getNuxtApp: unknown = Reflect.get(globalThis, 'useNuxtApp')

    if (typeof getNuxtApp !== 'function') {
      throw new TypeError('Nuxt app accessor is unavailable')
    }

    const app: unknown = Reflect.apply(getNuxtApp, globalThis, [])

    if (app === null || typeof app !== 'object') {
      throw new TypeError('Nuxt app is unavailable')
    }

    const router: unknown = Reflect.get(app, '$router')

    if (router === null || typeof router !== 'object') {
      throw new TypeError('Nuxt router is unavailable')
    }

    const push: unknown = Reflect.get(router, 'push')

    if (typeof push !== 'function') {
      throw new TypeError('Nuxt router navigation is unavailable')
    }

    await Reflect.apply(push, router, [destination])
  }, path)
}

async function trackSecurityDialogOpenings(page: Page) {
  await page.locator('dialog').evaluate((dialog) => {
    Reflect.set(globalThis, '__securityDialogOpened', false)

    const observer = new globalThis.MutationObserver((records) => {
      if (records.some(record => record.oldValue === null)) {
        Reflect.set(globalThis, '__securityDialogOpened', true)
      }
    })

    observer.observe(dialog, {
      attributes: true,
      attributeFilter: ['open'],
      attributeOldValue: true
    })
  })
}

async function dismissSecurityDialog(page: Page, dismissal: string) {
  if (dismissal === 'close button') {
    await page.getByRole('button', { name: 'Close security check' }).click()
  } else if (dismissal === 'Escape') {
    await page.keyboard.press('Escape')
  } else {
    await page.mouse.click(1, 1)
  }
}

async function expectSecurityDialogFitsViewport(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Security check' })

  const dimensions = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect()

    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      left: bounds.left,
      right: bounds.right,
      viewportWidth: globalThis.document.documentElement.clientWidth
    }
  })

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  expect(dimensions.left).toBeGreaterThanOrEqual(0)
  expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth)
}

test.describe('Login page', () => {
  test('should render an interaction-only security check and secondary Guest action', async ({
    page,
    turnstile
  }) => {
    await page.goto('/login')

    const guestButton = page.getByRole('button', {
      name: 'Continue as guest',
      exact: true
    })

    const twitchButton = page.getByRole('button', {
      name: 'Continue with Twitch',
      exact: true
    })

    await expect(guestButton).toBeEnabled()
    await expect(guestButton).toHaveClass(/secondary/u)
    await expect(twitchButton).toBeVisible()
    await expect(twitchButton).toHaveClass(/secondary/u)
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0)

    const renderOptions = await turnstile.getRenderOptions(page)

    expect(renderOptions).toStrictEqual([{
      action: 'email_sign_in',
      appearance: 'interaction-only',
      execution: 'execute',
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

  test('should verify only after clicking Guest and continue automatically', async ({ page, turnstile }) => {
    const requestBodies: unknown[] = []

    await page.route('**/api/auth/create-session', async (route) => {
      requestBodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    await turnstile.pause(page)
    await page.goto('/login')

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await turnstile.getRenderOptions(page)
    await expect(guestButton).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeEnabled()
    await expect(page.getByRole('status')).toHaveCount(0)
    expect(requestBodies).toStrictEqual([])
    await guestButton.click()

    await expect.poll(async () => turnstile.getRenderOptions(page)).toContainEqual(
      expect.objectContaining({ action: 'guest_session' })
    )

    await expect(guestButton).toBeDisabled()
    await expect(guestButton).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('status')).toHaveText('Complete the security check to continue.')
    expect(requestBodies).toStrictEqual([])
    await turnstile.complete(page)
    await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')
    await expect(guestButton).toBeEnabled()
    expect(requestBodies).toStrictEqual([{ 'cf-turnstile-response': 'turnstile-token-1' }])
  })

  for (const failure of ['expire', 'timeout', 'failChallenge'] as const) {
    test(`should retry ${failure} inside the security dialog`, async ({ page, turnstile }) => {
      const requestBodies: unknown[] = []

      await page.route('**/api/auth/create-session', async (route) => {
        requestBodies.push(route.request().postDataJSON())

        await route.fulfill({
          status: 503,
          json: { statusCode: 503 }
        })
      })

      await turnstile.pause(page)
      await page.goto('/login')
      await turnstile.getRenderOptions(page)

      const guestButton = page.getByRole('button', { name: 'Guest' })
      const dialog = page.getByRole('dialog', { name: 'Security check' })

      await guestButton.click()
      await expect(dialog).toBeVisible()
      await turnstile[failure](page)
      await expect(dialog.getByRole('alert')).toHaveText('Security check is unavailable. Try again.')
      expect(requestBodies).toStrictEqual([])
      await dialog.getByRole('button', { name: 'Try again' }).click()
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('alert')).toHaveCount(0)
      await expect(dialog.getByText('Turnstile challenge', { exact: true })).toBeVisible()
      await turnstile.replayRemovedCallbacks(page)
      await expect(dialog).toBeVisible()
      expect(requestBodies).toStrictEqual([])
      await turnstile.complete(page)
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')
      await expect(guestButton).toBeEnabled()
      expect(requestBodies).toStrictEqual([{ 'cf-turnstile-response': 'turnstile-token-1' }])
      expect(await turnstile.getRenderOptions(page)).toHaveLength(3)
    })
  }

  test('should never open the security dialog during automatic verification', async ({ page, turnstile }) => {
    const requestBodies: unknown[] = []

    await page.route('**/api/auth/create-session', async (route) => {
      requestBodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    await turnstile.pauseAutomatically(page)
    await page.goto('/login')
    await turnstile.getRenderOptions(page)
    await trackSecurityDialogOpenings(page)

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await guestButton.click()
    await expect(guestButton).toHaveText('Continue as guest')
    await expect(guestButton).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(requestBodies).toStrictEqual([])
    await turnstile.complete(page)
    await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')

    const dialogOpened = await page.evaluate(() => {
      const opened: unknown = Reflect.get(globalThis, '__securityDialogOpened')

      return opened
    })

    expect(dialogOpened).toBe(false)
    expect(requestBodies).toStrictEqual([{ 'cf-turnstile-response': 'turnstile-token-1' }])
  })

  for (const dismissal of ['close button', 'Escape', 'backdrop'] as const) {
    test(`should cancel verification with ${dismissal} and ignore obsolete callbacks`, async ({ page, turnstile }) => {
      const requestBodies: unknown[] = []

      await page.route('**/api/auth/create-session', async (route) => {
        requestBodies.push(route.request().postDataJSON())

        await route.fulfill({
          status: 503,
          json: { statusCode: 503 }
        })
      })

      await turnstile.pause(page)
      await page.goto('/login')
      await turnstile.getRenderOptions(page)

      const guestButton = page.getByRole('button', { name: 'Guest' })
      const dialog = page.getByRole('dialog', { name: 'Security check' })

      await guestButton.click()
      await expect(dialog.getByRole('heading', { name: 'Security check' })).toBeFocused()
      await dismissSecurityDialog(page, dismissal)
      await expect(dialog).toHaveCount(0)
      await expect(guestButton).toBeEnabled()
      await expect(guestButton).toBeFocused()
      await expect(guestButton).not.toHaveAttribute('aria-busy', 'true')
      await turnstile.replayRemovedCallbacks(page)
      await expect(dialog).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(requestBodies).toStrictEqual([])
      await guestButton.click()
      await expect(dialog).toBeVisible()
      await turnstile.replayRemovedCallbacks(page)
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('alert')).toHaveCount(0)
      expect(requestBodies).toStrictEqual([])
      await turnstile.complete(page)
      await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')
      expect(requestBodies).toStrictEqual([{ 'cf-turnstile-response': 'turnstile-token-1' }])
    })
  }

  test('should cancel a failed security check without submitting a session', async ({ page, turnstile }) => {
    await turnstile.pause(page)
    await page.goto('/login')
    await turnstile.getRenderOptions(page)

    const guestButton = page.getByRole('button', { name: 'Guest' })
    const dialog = page.getByRole('dialog', { name: 'Security check' })

    await guestButton.click()
    await expect(dialog).toBeVisible()
    await turnstile.failChallenge(page)
    await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(guestButton).toBeEnabled()
    await expect(guestButton).toBeFocused()
    await turnstile.replayRemovedCallbacks(page)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(dialog).toHaveCount(0)
  })

  for (const width of [320, 390, 1280]) {
    test(`should keep login buttons stationary with the security dialog at ${width}px`, async ({ page, turnstile }) => {
      await page.setViewportSize({
        width,
        height: 844
      })

      await turnstile.pause(page)
      await page.goto('/login')
      await turnstile.getRenderOptions(page)

      const guestButton = page.getByRole('button', { name: 'Guest' })
      const twitchButton = page.getByRole('button', { name: 'Twitch' })
      const guestBox = await guestButton.boundingBox()
      const twitchBox = await twitchButton.boundingBox()
      const dialog = page.getByRole('dialog', { name: 'Security check' })

      await guestButton.click()
      await expect(dialog.getByText('Turnstile challenge', { exact: true })).toBeVisible()
      await expect.poll(async () => guestButton.boundingBox()).toStrictEqual(guestBox)
      await expect.poll(async () => twitchButton.boundingBox()).toStrictEqual(twitchBox)
      await expect(dialog.getByRole('heading')).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(dialog.getByRole('button', { name: 'Close security check' })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(guestButton).not.toBeFocused()
      await expect(twitchButton).not.toBeFocused()
      await expectSecurityDialogFitsViewport(page)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect.poll(async () => guestButton.boundingBox()).toStrictEqual(guestBox)
      await expect.poll(async () => twitchButton.boundingBox()).toStrictEqual(twitchBox)
    })
  }

  test('should fail safely when the Turnstile script cannot load', async ({ page, turnstile }) => {
    await turnstile.failScriptLoad(page)
    await page.goto('/login')
    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page.getByRole('alert')).toHaveText(
      'Security check is unavailable. Try again.'
    )

    await expect(page.getByRole('button', { name: 'Guest' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeEnabled()
    await page.unrouteAll({ behavior: 'wait' })

    await page.route('**/api/auth/create-session', async (route) => {
      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')
    await expect(page.getByRole('button', { name: 'Guest' })).toBeEnabled()
  })

  test('should complete an early Guest click after the script loads', async ({ page }) => {
    const scriptGate = createDeferred()
    const requestBodies: unknown[] = []

    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', async (route) => {
      await scriptGate.promise

      await route.fallback()
    })

    await page.route('**/api/auth/create-session', async (route) => {
      requestBodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    const scriptRequest = page.waitForRequest('https://challenges.cloudflare.com/turnstile/v0/api.js**')

    await page.goto('/login', { waitUntil: 'domcontentloaded' })

    await scriptRequest

    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page.getByRole('button', { name: 'Guest' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Guest' })).toHaveAttribute('aria-busy', 'true')
    expect(requestBodies).toStrictEqual([])
    scriptGate.resolve()
    await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')
    await expect(page.getByRole('button', { name: 'Guest' })).toBeEnabled()
    expect(requestBodies).toStrictEqual([{ 'cf-turnstile-response': 'turnstile-token-1' }])
  })

  test('should reuse the loaded SDK after leaving and returning to login', async ({ page, turnstile }) => {
    // Exercise SDK reuse independently of document transition animations.
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const scriptRequests: string[] = []
    const requestBodies: unknown[] = []

    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js**', async (route) => {
      scriptRequests.push(route.request().url())
      await route.fallback()
    })

    await page.route('**/api/auth/create-session', async (route) => {
      requestBodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    await turnstile.pause(page)
    await page.goto('/login')
    await turnstile.getRenderOptions(page)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page.getByRole('dialog', { name: 'Security check' })).toBeVisible()
    await navigateWithinApp(page, '/__e2e/modal-dialog')
    await expect(page.getByRole('button', { name: 'Open centered dialog' })).toBeVisible()
    await turnstile.replayRemovedCallbacks(page)
    expect(requestBodies).toStrictEqual([])
    await navigateWithinApp(page, '/login')
    await expect.poll(async () => turnstile.getRenderOptions(page)).toHaveLength(3)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page.getByRole('dialog', { name: 'Security check' })).toBeVisible()
    await turnstile.replayRemovedCallbacks(page)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(requestBodies).toStrictEqual([])
    await turnstile.complete(page)
    await expect(page.getByRole('alert')).toHaveText('Guest access is temporarily unavailable. Try again.')
    expect(requestBodies).toStrictEqual([{ 'cf-turnstile-response': 'turnstile-token-1' }])
    expect(scriptRequests).toStrictEqual(['https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'])
    await expect(page.locator('script[src*="challenges.cloudflare.com/turnstile/"]')).toHaveCount(1)
  })

  test('should return to the api document after guest login', async ({ page, turnstile }) => {
    let guestRequestBody: unknown = null

    await page.route(brandsApiRoute, continueRoute)
    await page.goto('/api/equipment/brands')
    await page.unroute(brandsApiRoute, continueRoute)
    await expect(page).toHaveURL(/\/login\?redirectTo=\/api\/equipment\/brands$/u)
    await turnstile.getRenderOptions(page)

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

  test('should carry Guest user state into the original app destination', async ({ page, turnstile }) => {
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
    await turnstile.getRenderOptions(page)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(/\/gear-library\/new$/u)
    await expect(page.getByText('Guest accounts cannot submit gear for review.')).toBeVisible()
    await expect.poll(async () => getClientUserId(page)).toBe(responseUserId)
  })

  for (const { message, status } of guestErrorScenarios) {
    test(`should show the safe Guest error for ${status}`, async ({ page, turnstile }) => {
      await page.route('**/api/auth/create-session', async (route) => {
        await route.fulfill({
          json: { statusCode: status },
          status
        })
      })

      await page.goto('/login')
      await turnstile.getRenderOptions(page)

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
    await turnstile.getRenderOptions(page)

    const guestButton = page.getByRole('button', { name: 'Guest' })

    await expect(guestButton).toBeEnabled()
    await guestButton.click()
    await expect(page.getByRole('status')).toBeVisible()
    await turnstile.complete(page)
    await expect(page.getByRole('alert')).toHaveText('Security check failed. Try again.')
    await expect(guestButton).toBeEnabled()
    await guestButton.click()
    await expect(page.getByRole('status')).toBeVisible()
    await turnstile.complete(page)
    await expect(page).toHaveURL(/\/gear-library\/new$/u)

    expect(requestBodies).toStrictEqual([
      {
        'cf-turnstile-response': 'turnstile-token-1'
      },
      {
        'cf-turnstile-response': 'turnstile-token-2'
      }
    ])

    expect(await turnstile.getRenderOptions(page)).toHaveLength(3)
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
    await turnstile.getRenderOptions(page)
    await expect(page.getByRole('button', { name: 'Guest' })).toBeEnabled()
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

})
