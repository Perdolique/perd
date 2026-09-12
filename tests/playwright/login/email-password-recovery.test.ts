import type { Page, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { appBaseUrl } from '../constants.ts'

const email = 'trip@example.com'
const token = 'a'.repeat(43)
const password = 'A fresh exact passphrase 🌲 '

async function fillResetForm(page: Page, selectedPassword = password) {
  await page.getByLabel('New password', { exact: true }).fill(selectedPassword)
  await page.getByLabel('Confirm password', { exact: true }).fill(selectedPassword)
}

async function getClientUserId(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const state: unknown = Reflect.get(globalThis, 'useNuxtApp')

    if (typeof state !== 'function') {
      throw new TypeError('Nuxt app accessor is unavailable')
    }

    const app: unknown = Reflect.apply(state, globalThis, [])
    const payload: unknown = app !== null && typeof app === 'object' ? Reflect.get(app, 'payload') : undefined
    const payloadState: unknown = payload !== null && typeof payload === 'object' ? Reflect.get(payload, 'state') : undefined

    const user: unknown = payloadState !== null && typeof payloadState === 'object'
      ? Reflect.get(payloadState, '$suser')
      : undefined

    const userId: unknown = user !== null && typeof user === 'object' ? Reflect.get(user, 'userId') : undefined

    return userId ?? null
  })
}

async function fulfillBreachedThenSuccess(route: Route, bodies: unknown[]) {
  bodies.push(route.request().postDataJSON())

  if (bodies.length === 1) {
    await route.fulfill({
      status: 400,

      json: {
        statusCode: 400,
        statusMessage: 'Choose a password that has not appeared in a data breach'
      }
    })

    return
  }

  await route.fulfill({ json: { reset: true } })
}

async function fulfillTemporaryThenSuccess(route: Route, bodies: unknown[]) {
  bodies.push(route.request().postDataJSON())

  if (bodies.length === 1) {
    await route.fulfill({
      status: 503,
      json: { statusCode: 503 }
    })

    return
  }

  await route.fulfill({
    status: 200,
    json: { reset: true }
  })
}

function getTurnstileResponse(body: unknown): unknown {
  return body !== null && typeof body === 'object'
    ? Reflect.get(body, 'cf-turnstile-response')
    : undefined
}

test.describe('Email password recovery', () => {
  test('requests neutral recovery by keyboard and resends with a fresh Turnstile token', async ({ page, turnstile }) => {
    const bodies: unknown[] = []

    await page.route('**/api/auth/email/password-recovery', async (route) => {
      bodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 202,
        json: { accepted: true }
      })
    })

    await page.goto('/login?redirectTo=/account')

    const recoveryLink = page.getByRole('link', { name: 'Forgot password?' })

    await expect(recoveryLink).toHaveAttribute('href', '/forgot-password?redirectTo=/account')
    await recoveryLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`${appBaseUrl}/forgot-password?redirectTo=/account`)

    await expect.poll(async () => turnstile.getRenderOptions(page)).toContainEqual(
      expect.objectContaining({
        action: 'password_recovery_request',
        appearance: 'interaction-only',
        execution: 'execute',
        responseField: false
      })
    )

    await page.getByLabel('Email', { exact: true }).focus()
    await page.keyboard.type(email)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Send reset email' })).toBeFocused()
    await page.keyboard.press('Enter')

    const acceptedStatus = page.getByRole('status')

    await expect(acceptedStatus).toHaveText(
      'If an account can use password recovery, an email may arrive soon. If it does not arrive, try again later.'
    )

    await expect(acceptedStatus).toBeFocused()
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
    await page.getByRole('button', { name: 'Send another email' }).click()
    await expect.poll(() => bodies.length).toBe(2)

    expect(bodies).toStrictEqual([
      {
        email,
        redirectTo: '/account',
        'cf-turnstile-response': 'turnstile-token-1'
      },
      {
        email,
        redirectTo: '/account',
        'cf-turnstile-response': 'turnstile-token-2'
      }
    ])
  })

  test('keeps the email and retries a temporary request failure with a fresh Turnstile token', async ({ page, turnstile }) => {
    const bodies: unknown[] = []

    await page.route('**/api/auth/email/password-recovery', async (route) => {
      bodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })
    })

    await page.goto('/forgot-password?redirectTo=/account')

    await expect.poll(async () => turnstile.getRenderOptions(page)).toContainEqual(
      expect.objectContaining({ action: 'password_recovery_request' })
    )

    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByRole('button', { name: 'Send reset email' }).click()
    await expect(page.getByRole('alert')).toHaveText('Password recovery is temporarily unavailable. Try again.')
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email)
    await expect(page.getByRole('button', { name: 'Send reset email' })).toBeFocused()
    await page.unroute('**/api/auth/email/password-recovery')

    await page.route('**/api/auth/email/password-recovery', async (route) => {
      bodies.push(route.request().postDataJSON())

      await route.fulfill({
        status: 202,
        json: { accepted: true }
      })
    })

    await page.getByRole('button', { name: 'Send reset email' }).click()

    await expect(page.getByRole('status')).toHaveText(
      'If an account can use password recovery, an email may arrive soon. If it does not arrive, try again later.'
    )

    expect(bodies.map(body => getTurnstileResponse(body))).toStrictEqual([
      'turnstile-token-1',
      'turnstile-token-2'
    ])
  })

  test('removes the reset token from URL, router history, storage, and referrers', async ({ page, turnstile }) => {
    await page.goto('/login')
    await page.goto(`/auth/reset-password?redirectTo=/account#token=${token}`)
    await expect(page).toHaveURL(`${appBaseUrl}/auth/reset-password?redirectTo=/account`)
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
    await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
    await expect(page.getByLabel('Confirm password', { exact: true })).toHaveAttribute('autocomplete', 'new-password')

    expect(await turnstile.getRenderOptions(page)).toContainEqual(
      expect.objectContaining({ action: 'password_recovery_reset' })
    )

    const browserState = await page.evaluate(() => {
      return {
        hash: globalThis.location.hash,
        history: JSON.stringify(globalThis.history.state),
        local: JSON.stringify(globalThis.localStorage),
        session: JSON.stringify(globalThis.sessionStorage)
      }
    })

    expect(JSON.stringify(browserState)).not.toContain(token)
    expect(browserState.hash).toBe('')
    await page.goBack()
    await expect(page).toHaveURL(`${appBaseUrl}/login`)
    expect(page.url()).not.toContain(token)
  })

  for (const [scenario, path] of [
    ['missing', '/auth/reset-password'],
    ['malformed', '/auth/reset-password#token=malformed']
  ] as const) {
    test(`shows a separate invalid-link state for a ${scenario} token`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('alert')).toHaveText('This password reset link is invalid or expired.')
      await expect(page.getByRole('alert')).toBeFocused()
      await expect(page.getByRole('link', { name: 'Request a new reset email' })).toHaveAttribute('href', '/forgot-password?redirectTo=/')
      await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
    })
  }

  test('rejects mismatched passwords before starting Turnstile or sending a request', async ({ page, turnstile }) => {
    const bodies: unknown[] = []

    await page.route('**/api/auth/email/password-recovery/reset', async (route) => {
      bodies.push(route.request().postDataJSON())
      await route.fulfill({ json: { reset: true } })
    })

    await turnstile.pause(page)
    await page.goto(`/auth/reset-password?redirectTo=/account#token=${token}`)
    await turnstile.getRenderOptions(page)
    await page.getByLabel('New password', { exact: true }).fill(password)
    await page.getByLabel('Confirm password', { exact: true }).fill(`${password} different`)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByLabel('Confirm password', { exact: true })).toBeFocused()
    await expect(page.getByText('Passwords do not match.')).toBeVisible()
    expect(bodies).toStrictEqual([])
  })

  test('clears a breached password, retries with a fresh token, and does not sign in automatically', async ({ page, turnstile }) => {
    const bodies: unknown[] = []

    await page.route('**/api/auth/email/password-recovery/reset', async (route) => {
      await fulfillBreachedThenSuccess(route, bodies)
    })

    await page.goto(`/auth/reset-password?redirectTo=/account#token=${token}`)
    await turnstile.getRenderOptions(page)
    await fillResetForm(page)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByRole('alert')).toHaveText('Choose a password that has not appeared in a data breach.')
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue('')
    await expect(page.getByLabel('New password', { exact: true })).toBeFocused()
    await fillResetForm(page, 'A safer replacement passphrase 🌳')
    await page.getByRole('button', { name: 'Reset password' }).click()

    const successStatus = page.getByRole('status')

    await expect(successStatus).toHaveText('Your password has been reset. Sign in with your new password.')
    await expect(successStatus).toBeFocused()
    await expect(getClientUserId(page)).resolves.toBeNull()

    expect(bodies).toStrictEqual([
      {
        token,
        password,
        'cf-turnstile-response': 'turnstile-token-1'
      },
      {
        token,
        password: 'A safer replacement passphrase 🌳',
        'cf-turnstile-response': 'turnstile-token-2'
      }
    ])

    await page.getByRole('link', { name: 'Continue to sign in' }).click()
    await expect(page).toHaveURL(`${appBaseUrl}/login?redirectTo=/account`)
  })

  test('keeps fields for a temporary failure and uses a fresh token for retry', async ({ page }) => {
    const bodies: unknown[] = []

    await page.route('**/api/auth/email/password-recovery/reset', async (route) => {
      await fulfillTemporaryThenSuccess(route, bodies)
    })

    await page.goto(`/auth/reset-password#token=${token}`)
    await fillResetForm(page)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByRole('alert')).toHaveText('Password recovery is temporarily unavailable. Try again.')
    await expect(page.getByLabel('New password', { exact: true })).toHaveValue(password)
    await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue(password)
    await expect(page.getByRole('button', { name: 'Reset password' })).toBeFocused()
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByRole('status')).toContainText('Your password has been reset')

    expect(bodies.map(body => getTurnstileResponse(body))).toStrictEqual([
      'turnstile-token-1',
      'turnstile-token-2'
    ])
  })

  test('turns an expired or replayed server token into the invalid-link state', async ({ page }) => {
    await page.route('**/api/auth/email/password-recovery/reset', async (route) => {
      await route.fulfill({
        status: 400,

        json: {
          statusCode: 400,
          statusMessage: 'The password reset link is invalid or expired'
        }
      })
    })

    await page.goto(`/auth/reset-password#token=${token}`)
    await fillResetForm(page)
    await page.getByRole('button', { name: 'Reset password' }).click()
    await expect(page.getByRole('alert')).toHaveText('This password reset link is invalid or expired.')
    await expect(page.getByRole('alert')).toBeFocused()
    await expect(page.getByRole('link', { name: 'Request a new reset email' })).toBeVisible()
    await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
  })
})
