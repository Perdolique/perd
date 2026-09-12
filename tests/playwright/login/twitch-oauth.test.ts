import type { Page, Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { twitchOAuthMessages } from '../../../shared/utils/twitch-oauth.ts'

const state = 'a'.repeat(43)
const freshState = 'b'.repeat(43)

const response = {
  userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
  email: null,
  isAdmin: false,
  isGuest: false,
  redirectTo: '/api/equipment/brands'
} as const

async function mockTwitchOAuthRetry(page: Page, callbackBodies: unknown[]) {
  let callbackAttemptCount = 0

  async function respond(route: Route) {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 302,
        headers: { location: `/auth/twitch?code=new-code&state=${freshState}` }
      })

      return
    }

    const body: unknown = route.request().postDataJSON()

    callbackBodies.push(body)

    callbackAttemptCount += 1

    const options = callbackAttemptCount === 1
      ? {
        status: 400,

        json: {
          statusCode: 400,
          statusMessage: twitchOAuthMessages.invalid
        }
      }
      : { json: response }

    await route.fulfill(options)
  }

  await page.route('**/api/oauth/twitch**', respond)
}

test.describe('Twitch OAuth callback', () => {
  test('sends state, removes callback parameters before POST, and uses only the server redirect', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      expect(route.request().method()).toBe('POST')

      expect(route.request().postDataJSON()).toStrictEqual({
        code: 'oauth-code',
        state
      })

      expect(new globalThis.URL(page.url()).search).toBe('')
      expect(await route.request().headerValue('referer')).toBeNull()
      await route.fulfill({ json: response })
    })

    await page.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({ json: [] })
    })

    await page.goto(`/auth/twitch?code=oauth-code&state=${state}&redirectTo=https://evil.example`)
    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)
    await expect(page.locator('body')).toHaveText('[]')
  })

  test('preserves an internal application redirect', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      await route.fulfill({ json: {
        ...response,
        redirectTo: '/__e2e/modal-dialog'
      } })
    })

    await page.goto(`/auth/twitch?code=oauth-code&state=${state}`)
    await expect(page).toHaveURL(/\/__e2e\/modal-dialog$/u)
  })

  test('forwards a cancellation and provides an accessible return to sign in', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      expect(route.request().postDataJSON()).toStrictEqual({
        error: 'access_denied',
        state
      })

      await route.fulfill({
        status: 400,

        json: {
          statusCode: 400,
          statusMessage: twitchOAuthMessages.cancelled
        }
      })
    })

    await page.goto(`/auth/twitch?error=access_denied&error_description=private-provider-description&state=${state}`)
    await expect(page).toHaveURL(/\/auth\/twitch$/u)
    await expect(page.getByRole('status')).toHaveText(twitchOAuthMessages.cancelled)
    await expect(page.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/login')
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
    await expect(page.locator('body')).not.toContainText('private-provider-description')
    await page.getByRole('link', { name: 'Return to sign in' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/login$/u)
  })

  test('shows a safe verification error for an invalid or expired attempt and starts a fresh attempt on retry', async ({ page }) => {
    const callbackBodies: unknown[] = []

    await mockTwitchOAuthRetry(page, callbackBodies)

    await page.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({ json: [] })
    })

    await page.goto(`/auth/twitch?code=old-code&state=${state}`)
    await expect(page.getByRole('status')).toHaveText(twitchOAuthMessages.invalid)
    await expect(page).toHaveURL(/\/auth\/twitch$/u)
    await page.getByRole('link', { name: 'Return to sign in' }).click()

    await page.getByRole('button', {
      name: 'Continue with Twitch',
      exact: true
    }).click()

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)

    expect(callbackBodies).toStrictEqual([{
      code: 'old-code',
      state
    }, {
      code: 'new-code',
      state: freshState
    }])
  })

  for (const query of ['code=oauth-code', 'code=oauth-code&state=%2Fmy-gear', 'code=oauth-code&state=one&state=two']) {
    test(`handles malformed callback ${query} without navigating to its state`, async ({ page }) => {
      await page.route('**/api/oauth/twitch', async (route) => {
        await route.fulfill({
          status: 400,

          json: {
            statusCode: 400,
            statusMessage: twitchOAuthMessages.invalid
          }
        })
      })

      await page.goto(`/auth/twitch?${query}`)
      await expect(page).toHaveURL(/\/auth\/twitch$/u)
      await expect(page.getByRole('status')).toHaveText(twitchOAuthMessages.invalid)
    })
  }

  test('never renders raw server errors', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      await route.fulfill({
        status: 503,

        json: {
          statusCode: 503,
          statusMessage: 'private database failure'
        }
      })
    })

    await page.goto(`/auth/twitch?code=oauth-code&state=${state}`)
    await expect(page.getByRole('status')).toHaveText(twitchOAuthMessages.unavailable)
    await expect(page.locator('body')).not.toContainText('private database failure')
  })
})
