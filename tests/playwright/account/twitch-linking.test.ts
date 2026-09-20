import type { Page, Route } from '@playwright/test'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const password = 'A long exact passphrase 🌲 '

interface AccountUser {
  email: string | null;
  isAdmin: boolean;
  isGuest: boolean;
  isTwitchLinked: boolean;
  userId: string;
}

interface RequestGate {
  promise: Promise<void>;
}

async function mockGuestAuthentication(page: Page): Promise<void> {
  await page.route('**/api/auth/create-session', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        isGuest: true,
        userId
      }
    })
  })
}

async function openGuestAccount(page: Page, redirectTo = '/account'): Promise<void> {
  await page.goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
  await waitForInitialEmailSignInTurnstile(page)
  await page.getByRole('button', { name: 'Continue as guest' }).click()
  await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
}

async function mockAccountUser(page: Page, user: AccountUser): Promise<void> {
  await page.route('**/api/user', async (route) => {
    await route.fulfill({ json: user })
  })
}

async function mockRetryingAccountUser(page: Page, user: AccountUser): Promise<() => number> {
  let requestCount = 0

  await page.route('**/api/user', async (route) => {
    requestCount += 1

    if (requestCount === 1) {
      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })

      return
    }

    await route.fulfill({ json: user })
  })

  return () => requestCount
}

async function mockRetryingTwitchDisconnect(
  page: Page,
  firstRequestGate: RequestGate
): Promise<() => number> {
  let requestCount = 0

  const responders: ((route: Route) => Promise<void>)[] = [async (route) => {
    await firstRequestGate.promise

    await route.fulfill({
      status: 503,

      json: {
        statusCode: 503,
        statusMessage: 'private database failure'
      }
    })
  }, async (route) => {
    await route.fulfill({
      json: {
        isTwitchLinked: false
      }
    })
  }]

  await page.route('**/api/oauth/twitch', async (route) => {
    expect(route.request().method()).toBe('DELETE')

    const responder = responders.at(requestCount)

    requestCount += 1

    if (responder === undefined) {
      throw new Error('Unexpected Twitch disconnect request')
    }

    await responder(route)
  })

  return () => requestCount
}

function getOnlyRequestUrl(requests: readonly string[]): InstanceType<typeof globalThis.URL> {
  const request = requests.at(0)

  if (request === undefined) {
    throw new Error('Expected one request URL')
  }

  return new globalThis.URL(request)
}

test.describe('Account Twitch linking', () => {
  test('shows an honest loading state and starts a protected link attempt once', async ({ page }) => {
    const userGate = createDeferred()

    await mockGuestAuthentication(page)

    await page.route('**/api/user', async (route) => {
      await userGate.promise

      await route.fulfill({
        json: {
          email: null,
          isAdmin: false,
          isGuest: true,
          isTwitchLinked: false,
          userId
        }
      })
    })

    await openGuestAccount(page)
    await expect(page.getByRole('status')).toHaveText('Loading sign-in methods…')
    await expect(page.getByText('Not connected', { exact: true })).toHaveCount(0)
    userGate.resolve()
    await expect(page.getByText('Not added', { exact: true })).toBeVisible()
    await expect(page.getByText('Not connected', { exact: true })).toBeVisible()

    const authorizationGate = createDeferred()
    const requests: string[] = []

    await page.route('**/api/oauth/twitch**', async (route) => {
      requests.push(route.request().url())

      await authorizationGate.promise

      await route.fulfill({
        json: {
          authorizationUrl: 'https://id.twitch.tv/oauth2/authorize?state=test-state'
        }
      })
    })

    await page.route('https://id.twitch.tv/**', async (route) => {
      await route.abort('blockedbyclient')
    })

    const connectButton = page.getByRole('button', {
      name: 'Connect Twitch',
      exact: true
    })

    await connectButton.click()
    await expect(connectButton).toHaveAttribute('aria-busy', 'true')
    await expect(connectButton).toHaveText(/Connect Twitch/u)
    await expect(connectButton).toBeDisabled()
    expect(requests).toHaveLength(1)

    const requestUrl = getOnlyRequestUrl(requests)

    expect(requestUrl.searchParams.get('intent')).toBe('link')
    expect(requestUrl.searchParams.get('redirectTo')).toBe('/account')
    expect(requestUrl.searchParams.get('responseMode')).toBe('json')

    const twitchNavigationPromise = page.waitForRequest('https://id.twitch.tv/**')

    authorizationGate.resolve()

    await twitchNavigationPromise
  })

  test('shows a safe load error and recovers on Retry', async ({ page }) => {
    await mockGuestAuthentication(page)

    const getRequestCount = await mockRetryingAccountUser(page, {
      email: null,
      isAdmin: false,
      isGuest: true,
      isTwitchLinked: false,
      userId
    })

    await openGuestAccount(page)
    await expect(page.getByRole('alert')).toContainText('Could not load sign-in methods. Try again.')
    await expect(page.getByText('Not connected', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('Not connected', { exact: true })).toBeVisible()
    expect(getRequestCount()).toBe(2)
  })

  test('shows verified email and Connected without exposing provider data', async ({ page }) => {
    await mockAccountUser(page, {
      email: 'trip@example.com',
      isAdmin: false,
      isGuest: false,
      isTwitchLinked: true,
      userId
    })

    await page.route('**/api/auth/email/sign-in', async (route) => {
      await route.fulfill({
        json: {
          email: 'trip@example.com',
          isAdmin: false,
          isGuest: false,
          userId
        }
      })
    })

    await page.goto('/login?redirectTo=/account')
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByLabel('Email', { exact: true }).fill('trip@example.com')
    await page.getByLabel('Password', { exact: true }).fill(password)

    await page.getByRole('button', {
      name: 'Sign in',
      exact: true
    }).click()

    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible()
    await expect(page.getByText('trip@example.com', { exact: true })).toBeVisible()
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()

    await expect(page.getByRole('button', {
      name: 'Connect Twitch',
      exact: true
    })).toHaveCount(0)

    await expect(page.getByRole('button', {
      name: 'Disconnect Twitch',
      exact: true
    })).toBeVisible()

    await expect(page.locator('body')).not.toContainText('twitch-account-id')
    await expect(page.locator('body')).not.toContainText('access-token')
  })

  test('requires a verified email before offering Twitch disconnect', async ({ page }) => {
    await mockGuestAuthentication(page)

    await mockAccountUser(page, {
      email: null,
      isAdmin: false,
      isGuest: false,
      isTwitchLinked: true,
      userId
    })

    await openGuestAccount(page)
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()
    await expect(page.getByText('Add and verify an email before disconnecting Twitch.')).toBeVisible()

    await expect(page.getByRole('button', {
      name: 'Disconnect Twitch',
      exact: true
    })).toHaveCount(0)

    await expect(page.getByRole('link', { name: 'Add email' })).toBeVisible()
  })

  test('keeps disconnect errors safe and retries before updating the current account', async ({ page }) => {
    const firstRequestGate = createDeferred()

    await mockGuestAuthentication(page)

    await mockAccountUser(page, {
      email: 'trip@example.com',
      isAdmin: true,
      isGuest: false,
      isTwitchLinked: true,
      userId
    })

    const getRequestCount = await mockRetryingTwitchDisconnect(page, firstRequestGate)

    await openGuestAccount(page)

    await page.getByRole('button', {
      name: 'Disconnect Twitch',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog')

    const confirmButton = dialog.getByRole('button', {
      name: 'Disconnect Twitch',
      exact: true
    })

    await expect(dialog.getByRole('heading', { name: 'Disconnect Twitch' })).toBeVisible()
    await expect(dialog).toContainText('Your account and data will stay available through your verified email.')
    await confirmButton.click()
    await expect(confirmButton).toHaveAttribute('aria-busy', 'true')
    await expect(confirmButton).toHaveText('Disconnect Twitch')
    await expect(confirmButton).toBeDisabled()
    expect(getRequestCount()).toBe(1)
    firstRequestGate.resolve()
    await expect(dialog.getByRole('alert')).toHaveText('Twitch could not be disconnected. Try again.')
    await expect(dialog).not.toContainText('private database failure')
    await expect(confirmButton).toBeEnabled()
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()
    await confirmButton.click()

    const successMessage = page.getByRole('status').filter({
      hasText: 'Twitch was disconnected. You can connect it again at any time.'
    })

    await expect(successMessage).toBeVisible()
    await expect(successMessage).toBeFocused()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Not connected', { exact: true })).toBeVisible()

    await expect(page.getByRole('button', {
      name: 'Connect Twitch',
      exact: true
    })).toBeVisible()

    await expect(page.getByRole('button', {
      name: 'Disconnect Twitch',
      exact: true
    })).toHaveCount(0)

    expect(getRequestCount()).toBe(2)
  })

  const bannerScenarios = [{
    outcome: 'success',
    role: 'status' as const,
    message: 'Twitch is now connected to this account.',
    isTwitchLinked: true,
    connectButtonCount: 0
  }, {
    outcome: 'conflict',
    role: 'alert' as const,
    message: 'This Twitch account is already connected to another account. Your current account and its data were not changed.',
    isTwitchLinked: false,
    connectButtonCount: 1
  }] as const

  for (const scenario of bannerScenarios) {
    test(`focuses and clears the ${scenario.outcome} banner while preserving the right action`, async ({ page }) => {
      await mockGuestAuthentication(page)

      await mockAccountUser(page, {
        email: null,
        isAdmin: false,
        isGuest: scenario.isTwitchLinked === false,
        isTwitchLinked: scenario.isTwitchLinked,
        userId
      })

      await openGuestAccount(page, `/account?twitchLink=${scenario.outcome}`)

      const banner = page.getByRole(scenario.role).filter({ hasText: scenario.message })

      await expect(banner).toHaveText(scenario.message)
      await expect(banner).toBeFocused()
      await expect(page).toHaveURL(/\/account$/u)

      await expect(page.getByRole('button', {
        name: 'Connect Twitch',
        exact: true
      })).toHaveCount(scenario.connectButtonCount)
    })
  }

  test('ignores a success query when the account is not linked', async ({ page }) => {
    await mockGuestAuthentication(page)

    await mockAccountUser(page, {
      email: null,
      isAdmin: false,
      isGuest: true,
      isTwitchLinked: false,
      userId
    })

    await openGuestAccount(page, '/account?twitchLink=success')
    await expect(page.getByText('Not connected', { exact: true })).toBeVisible()
    await expect(page.getByText('Twitch is now connected to this account.')).toHaveCount(0)
    await expect(page).toHaveURL(/\/account$/u)
  })

  test('keeps Connect Twitch available after a safe start error and retries', async ({ page }) => {
    let requestCount = 0

    await mockGuestAuthentication(page)

    await mockAccountUser(page, {
      email: null,
      isAdmin: false,
      isGuest: true,
      isTwitchLinked: false,
      userId
    })

    await page.route('**/api/oauth/twitch**', async (route) => {
      requestCount += 1

      await route.fulfill({
        status: 503,

        json: {
          statusCode: 503,
          statusMessage: 'private provider failure'
        }
      })
    })

    await openGuestAccount(page)

    const connectButton = page.getByRole('button', {
      name: 'Connect Twitch',
      exact: true
    })

    await connectButton.click()
    await expect(page.getByRole('alert')).toHaveText('Could not start the Twitch connection. Try again.')
    await expect(page.locator('body')).not.toContainText('private provider failure')
    await expect(connectButton).toBeEnabled()
    await connectButton.click()
    await expect.poll(() => requestCount).toBe(2)
  })
})
