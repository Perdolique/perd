import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { appBaseUrl } from '../constants.ts'

const password = 'A long exact passphrase 🌲 '
const token = 'a'.repeat(43)
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

const anonymous = {
  userId: null,
  email: null,
  isGuest: false,
  isAdmin: false
}

async function mockCurrentUser(page: Page, isGuest = false) {
  await page.route('**/api/user', async (route) => {
    await route.fulfill({ json: {
      userId,
      email: null,
      isGuest,
      isAdmin: true
    } })
  })
}

async function navigateWithinApp(page: Page, destination: string) {
  await page.evaluate(async (path) => {
    const accessor: unknown = Reflect.get(globalThis, 'useNuxtApp')

    if (typeof accessor !== 'function') {
      throw new TypeError('Nuxt app accessor is unavailable')
    }

    const app: unknown = Reflect.apply(accessor, globalThis, [])

    if (app === null || typeof app !== 'object') {
      throw new TypeError('Nuxt app is unavailable')
    }

    const router: unknown = Reflect.get(app, '$router')

    if (router === null || typeof router !== 'object') {
      throw new TypeError('Nuxt router is unavailable')
    }

    const push: unknown = Reflect.get(router, 'push')

    if (typeof push !== 'function') {
      throw new TypeError('Nuxt navigation is unavailable')
    }

    await Reflect.apply(push, router, [path])
  }, destination)
}

async function mockSuccessfulVerification(page: Page, bodies: unknown[]) {
  await page.route('**/api/auth/email/registration/verify', async (route) => {
    bodies.push(route.request().postDataJSON())

    await route.fulfill({ json: {
      user: {
        userId,
        email: 'trip@example.com',
        isGuest: false,
        isAdmin: true
      },

      redirectTo: '/account'
    } })
  })
}

test.describe('Email registration', () => {
  test('should register by keyboard, preserve the redirect and resend with a fresh security token on mobile', async ({ page, turnstile }) => {
    const bodies: unknown[] = []

    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.setViewportSize({
      width: 320,
      height: 844
    })

    await page.route('**/api/user', async route => route.fulfill({
      status: 401,
      json: { statusCode: 401 }
    }))

    await page.route('**/api/auth/email/registration', async (route) => {
      bodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 202,
        json: { accepted: true }
      })
    })

    await page.goto('/login?redirectTo=/account')
    await page.getByRole('link', { name: 'Create account' }).click()
    await expect(page).toHaveURL(`${appBaseUrl}/register?redirectTo=/account`)
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
    await page.getByLabel('Email', { exact: true }).focus()
    await page.keyboard.type('trip@example.com')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Send verification email' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('Check your email')
    await expect(page.getByRole('status')).toBeFocused()
    await page.screenshot({ path: test.info().outputPath('registration-mobile.png') })
    await page.getByRole('button', { name: 'Send another email' }).click()
    await expect.poll(() => bodies.length).toBe(2)

    expect(bodies).toEqual([
      {
        email: 'trip@example.com',
        password,
        redirectTo: '/account',
        'cf-turnstile-response': 'turnstile-token-1'
      },
      {
        email: 'trip@example.com',
        password,
        redirectTo: '/account',
        'cf-turnstile-response': 'turnstile-token-2'
      }
    ])

    const options = await turnstile.getRenderOptions(page)

    expect(options).toContainEqual(expect.objectContaining({ action: 'email_registration' }))

    const overflows = await page.evaluate(() => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth)

    expect(overflows).toBe(false)
  })

  test('should confirm in another browser only after entering the password and remove the token from history', async ({ page, browser }) => {
    await page.route('**/api/user', async route => route.fulfill({ json: anonymous }))

    await page.route('**/api/auth/email/registration', async route => route.fulfill({
      status: 202,
      json: { accepted: true }
    }))

    await page.goto('/register')
    await page.getByLabel('Email', { exact: true }).fill('trip@example.com')
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Send verification email' }).click()
    await expect(page.getByRole('status')).toContainText('Check your email')

    const other = await browser.newContext({ baseURL: appBaseUrl })

    try {
      const verificationPage = await other.newPage()
      const bodies: unknown[] = []

      await mockSuccessfulVerification(verificationPage, bodies)
      await verificationPage.goto(`/auth/verify-email#token=${token}`)
      await expect(verificationPage.getByRole('button', { name: 'Confirm email' })).toBeVisible()
      await expect(verificationPage).toHaveURL(`${appBaseUrl}/auth/verify-email`)
      expect(bodies).toEqual([])

      const stored = await verificationPage.evaluate(() => {
        const history: unknown = globalThis.history.state

        return {
          local: JSON.stringify(globalThis.localStorage),
          session: JSON.stringify(globalThis.sessionStorage),
          history
        }
      })

      expect(JSON.stringify(stored)).not.toContain(token)
      await verificationPage.getByLabel('Password', { exact: true }).fill(password)
      await verificationPage.getByRole('button', { name: 'Confirm email' }).click()
      await expect(verificationPage).toHaveURL(`${appBaseUrl}/account`)
      await expect(verificationPage.getByText('Verified email: trip@example.com')).toBeVisible()

      expect(bodies).toEqual([{
        token,
        password
      }])

      await expect(page.getByRole('status')).toContainText('Check your email')
    } finally {
      await other.close()
    }
  })

  for (const [accountType, isGuest] of [['Guest', true], ['Twitch', false]] as const) {
    test(`should add email to the current ${accountType} account and preserve its identity and admin access`, async ({ page }) => {
      await mockCurrentUser(page, isGuest)

      await page.route('**/api/auth/email/registration', async route => route.fulfill({
        status: 202,
        json: { accepted: true }
      }))

      const bodies: unknown[] = []

      await mockSuccessfulVerification(page, bodies)
      await page.goto('/register?redirectTo=/account')
      await expect(page.getByRole('heading', { name: 'Add email access' })).toBeVisible()
      await page.getByRole('link', { name: 'Back to Account' }).click()
      await expect(page.getByText(userId, { exact: true })).toBeVisible()
      await page.getByRole('link', { name: /Add email/u }).click()
      await page.getByLabel('Email', { exact: true }).fill('trip@example.com')
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Send verification email' }).click()
      await expect(page.getByRole('status')).toContainText('Check your email')
      await navigateWithinApp(page, `/auth/verify-email#token=${token}`)
      await page.getByLabel('Password', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Confirm email' }).click()
      await expect(page).toHaveURL(`${appBaseUrl}/account`)
      await expect(page.getByText(userId, { exact: true })).toBeVisible()
      await expect(page.getByText('Verified email: trip@example.com')).toBeVisible()
      await expect(page.getByRole('link', { name: /Admin/u }).last()).toBeVisible()
      await expect(page.getByRole('link', { name: /Add email/u })).toHaveCount(0)
    })
  }

  test('should retain verified email after a later Twitch sign-in', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      await route.fulfill({ json: {
        userId,
        email: 'trip@example.com',
        isGuest: false,
        isAdmin: true
      } })
    })

    await page.goto('/auth/twitch?code=e2e-twitch&state=/account')
    await expect(page).toHaveURL(`${appBaseUrl}/account`)
    await expect(page.getByText('Verified email: trip@example.com')).toBeVisible()
    await expect(page.getByRole('link', { name: /Add email/u })).toHaveCount(0)
  })

  test('should explain a lost original session without navigating or replacing the account', async ({ page }) => {
    await page.route('**/api/auth/email/registration/verify', async route => route.fulfill({
      status: 409,

      json: {
        statusCode: 409,
        statusMessage: 'Return to the browser where you started adding email'
      }
    }))

    await page.goto(`/auth/verify-email#token=${token}`)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Confirm email' }).click()
    await expect(page.getByRole('alert')).toHaveText('Return to the browser where you started adding email')
    await expect(page).toHaveURL(`${appBaseUrl}/auth/verify-email`)
    await expect(page.getByRole('button', { name: 'Confirm email' })).toBeEnabled()
    await page.reload()
    await expect(page.getByRole('status')).toContainText('Open the full verification link')
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  })

  test('should focus password errors and sanitize an unsafe redirect before requesting mail', async ({ page }) => {
    const bodies: unknown[] = []

    await page.route('**/api/user', async route => route.fulfill({ json: anonymous }))

    await page.route('**/api/auth/email/registration', async (route) => {
      bodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 202,
        json: { accepted: true }
      })
    })

    await page.goto('/register?redirectTo=https://other.example/')
    await page.getByLabel('Email', { exact: true }).fill('trip@example.com')
    await page.getByLabel('Password', { exact: true }).fill('too short')
    await page.getByRole('button', { name: 'Send verification email' }).click()
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused()
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toEqual([])
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Send verification email' }).click()
    await expect(page.getByRole('status')).toContainText('Check your email')
    expect(bodies).toEqual([expect.objectContaining({ redirectTo: '/' })])
  })
})
