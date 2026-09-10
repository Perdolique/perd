import type { Page, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

const email = 'walker@example.com'
const password = 'correct horse battery staple'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477dd'

const signInFailureScenarios = [
  {
    focus: 'password',
    message: 'Email or password is incorrect',
    status: 401
  },
  {
    focus: 'submit',
    message: 'Security check failed. Try again.',
    status: 403
  },
  {
    focus: 'submit',
    message: 'Too many sign-in attempts. Try again in a minute.',
    status: 429
  },
  {
    focus: 'submit',
    message: 'Sign in is temporarily unavailable. Try again.',
    status: 503
  }
] as const

async function getClientUser(page: Page) {
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

    const state: unknown = payload === null || typeof payload !== 'object'
      ? undefined
      : Reflect.get(payload, 'state')

    const user: unknown = state === null || typeof state !== 'object'
      ? undefined
      : Reflect.get(state, '$suser')

    if (user === null || typeof user !== 'object') {
      throw new TypeError('Nuxt user state is unavailable')
    }

    const userEmail: unknown = Reflect.get(user, 'email')
    const stateUserId: unknown = Reflect.get(user, 'userId')
    const isAdmin: unknown = Reflect.get(user, 'isAdmin')
    const isGuest: unknown = Reflect.get(user, 'isGuest')
    const hasData: unknown = Reflect.get(user, 'hasData')

    return {
      email: userEmail,
      userId: stateUserId,
      isAdmin,
      isGuest,
      hasData
    }
  })
}

async function fulfillSuccessfulSignIn(route: Route) {
  await route.fulfill({
    status: 200,

    json: {
      email,
      userId,
      isAdmin: true,
      isGuest: false
    }
  })
}

async function fillSignInForm(page: Page) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
}

async function captureAndFulfillRetriedSignIn(
  route: Route,
  requestBodies: unknown[],
  failureStatus: number
) {
  requestBodies.push(route.request().postDataJSON())

  if (requestBodies.length === 1) {
    await route.fulfill({
      status: failureStatus,
      json: { statusCode: failureStatus }
    })

    return
  }

  await fulfillSuccessfulSignIn(route)
}

function getExpectedFocus(page: Page, focus: 'password' | 'submit') {
  return focus === 'password'
    ? page.getByLabel('Password')
    : page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })
}

test.describe('Email sign-in', () => {
  test('should expose a password-manager form and keep all login options available', async ({ page, turnstile }) => {
    await page.goto('/login?redirectTo=/my-gear')

    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password')

    const signInButton = page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })

    const registrationLink = page.getByRole('link', {
      name: 'Create account',
      exact: true
    })

    await expect(page.getByRole('heading', {
      name: 'Sign in',
      exact: true
    })).toBeVisible()

    await expect(page.locator('form')).toHaveCount(1)
    await expect(emailInput).toHaveAttribute('type', 'email')
    await expect(emailInput).toHaveAttribute('name', 'email')
    await expect(emailInput).toHaveAttribute('autocomplete', 'username')
    await expect(emailInput).not.toBeFocused()
    await expect(passwordInput).toHaveAttribute('type', 'password')
    await expect(passwordInput).toHaveAttribute('name', 'password')
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    await expect(passwordInput).not.toBeFocused()
    await expect(signInButton).toHaveAttribute('type', 'submit')
    await expect(registrationLink).toHaveAttribute('href', '/register?redirectTo=/my-gear')

    await expect(page.getByRole('button', {
      name: 'Continue as guest',
      exact: true
    })).toBeVisible()

    await expect(page.getByRole('button', {
      name: 'Continue with Twitch',
      exact: true
    })).toBeVisible()

    expect(await turnstile.getRenderOptions(page)).toStrictEqual([{
      action: 'email_sign_in',
      appearance: 'interaction-only',
      execution: 'execute',
      responseField: false,
      sitekey: '1x00000000000000000000AA',
      size: 'flexible'
    }])
  })

  test('should disable every auth method while showing a spinner only on sign-in', async ({ page, turnstile }) => {
    await page.route('**/api/auth/email/sign-in', async (route) => {
      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    await turnstile.pause(page)
    await page.goto('/login')
    await turnstile.getRenderOptions(page)
    await fillSignInForm(page)

    const emailInput = page.getByLabel('Email')
    const passwordInput = page.getByLabel('Password')

    const signInButton = page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })

    const registrationLink = page.getByRole('link', {
      name: 'Create account',
      exact: true
    })

    const guestButton = page.getByRole('button', {
      name: 'Continue as guest',
      exact: true
    })

    const twitchButton = page.getByRole('button', {
      name: 'Continue with Twitch',
      exact: true
    })

    await signInButton.click()
    await expect(emailInput).toBeDisabled()
    await expect(passwordInput).toBeDisabled()
    await expect(signInButton).toBeDisabled()
    await expect(signInButton).toHaveAttribute('aria-busy', 'true')
    await expect(registrationLink).toHaveAttribute('aria-disabled', 'true')
    await expect(guestButton).toBeDisabled()
    await expect(guestButton).not.toHaveAttribute('aria-busy', 'true')
    await expect(twitchButton).toBeDisabled()
    await expect(twitchButton).not.toHaveAttribute('aria-busy', 'true')
    await turnstile.complete(page)
    await expect(page.getByRole('alert')).toHaveText('Sign in is temporarily unavailable. Try again.')
    await expect(signInButton).toBeFocused()
  })

  test('should sign in, replace full user state, and follow a safe app redirect', async ({ page, turnstile }) => {
    let requestBody: unknown = null

    await page.route('**/api/auth/email/sign-in', async (route) => {
      requestBody = route.request().postDataJSON()

      await fulfillSuccessfulSignIn(route)
    })

    await page.goto('/login?redirectTo=/__e2e/modal-dialog')
    await turnstile.getRenderOptions(page)
    await fillSignInForm(page)

    await page.getByRole('button', {
      name: 'Sign in',
      exact: true
    }).click()

    await expect(page).toHaveURL(/\/__e2e\/modal-dialog$/u)

    expect(requestBody).toStrictEqual({
      email,
      password,
      'cf-turnstile-response': 'turnstile-token-1'
    })

    await expect.poll(async () => getClientUser(page)).toStrictEqual({
      email,
      userId,
      isAdmin: true,
      isGuest: false,
      hasData: true
    })
  })

  test('should return to a safe api document after sign-in', async ({ page, turnstile }) => {
    const brandsApiRoute = '**/api/equipment/brands'

    await page.route('**/api/auth/email/sign-in', fulfillSuccessfulSignIn)
    await page.goto('/login?redirectTo=/api/equipment/brands')
    await turnstile.getRenderOptions(page)
    await fillSignInForm(page)

    await page.route(brandsApiRoute, async (route) => {
      await route.fulfill({ json: [] })
    })

    await page.getByRole('button', {
      name: 'Sign in',
      exact: true
    }).click()

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)
    await expect(page.locator('body')).toHaveText('[]')
  })

  for (const failure of signInFailureScenarios) {
    test(`should use a fresh token after ${failure.status} and restore ${failure.focus} focus`, async ({
      page,
      turnstile
    }) => {
      const requestBodies: unknown[] = []

      await page.route('**/api/auth/email/sign-in', async (route) => {
        await captureAndFulfillRetriedSignIn(route, requestBodies, failure.status)
      })

      await turnstile.pause(page)
      await page.goto('/login?redirectTo=/__e2e/modal-dialog')
      await turnstile.getRenderOptions(page)
      await fillSignInForm(page)

      const emailInput = page.getByLabel('Email')
      const passwordInput = page.getByLabel('Password')

      const signInButton = page.getByRole('button', {
        name: 'Sign in',
        exact: true
      })

      await signInButton.click()
      await turnstile.complete(page)
      await expect(page.getByRole('alert')).toHaveText(failure.message)
      await expect(emailInput).toHaveValue(email)
      await expect(passwordInput).toHaveValue(password)

      const expectedFocus = getExpectedFocus(page, failure.focus)

      await expect(expectedFocus).toBeFocused()
      await signInButton.click()
      await turnstile.complete(page)
      await expect(page).toHaveURL(/\/__e2e\/modal-dialog$/u)

      expect(requestBodies).toStrictEqual([
        {
          email,
          password,
          'cf-turnstile-response': 'turnstile-token-1'
        },
        {
          email,
          password,
          'cf-turnstile-response': 'turnstile-token-2'
        }
      ])

      expect(await turnstile.getRenderOptions(page)).toHaveLength(2)
    })
  }

  test('should keep the card and footer reachable without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({
      width: 320,
      height: 480
    })

    await page.goto('/login')

    const dimensions = await page.locator('html').evaluate((element) => {
      return {
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth
      }
    })

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
    expect(dimensions.scrollHeight).toBeGreaterThan(480)
    await page.getByRole('contentinfo').scrollIntoViewIfNeeded()

    await expect(page.getByRole('link', {
      name: 'GitHub',
      exact: true
    })).toBeVisible()
  })
})
