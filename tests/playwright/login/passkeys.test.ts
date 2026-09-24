import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/global.fixtures'
import { addVirtualAuthenticator, mockPasskeyAccount, openPasskeyAccount } from '../fixtures/passkey.fixtures'
import { createDeferred } from '../fixtures/gear-library-entry-list.fixtures'

interface PasskeyAuthenticatorStats {
  aborts: number;
  starts: number;
}

declare global {
  interface Window {
    passkeyAuthenticatorStats: PasskeyAuthenticatorStats;
  }
}

function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) {
    throw new Error('Expected test data')
  }

  return value
}

const switchActions = {
  async email(page: Page) {
    await page.getByRole('textbox', {
      name: 'Email',
      exact: true
    }).fill('walker@example.com')

    await page.getByLabel('Password', { exact: true }).fill('a correct long passphrase')

    await page.getByRole('button', {
      name: 'Sign in',
      exact: true
    }).click()
  },

  async guest(page: Page) { await page.getByRole('button', { name: 'Continue as guest' }).click() },
  async twitch(page: Page) { await page.getByRole('button', { name: /Twitch/u }).click() },
  async explicit(page: Page) { await page.getByRole('button', { name: 'Sign in with a passkey' }).click() },
  async navigation(page: Page) { await page.getByRole('link', { name: 'Forgot password?' }).click() }
}

async function trackPasskeyAuthenticator(page: Page) {
  await page.addInitScript(() => {
    const original = globalThis.navigator.credentials.get.bind(globalThis.navigator.credentials)

    globalThis.window.passkeyAuthenticatorStats = {
      aborts: 0,
      starts: 0
    }

    globalThis.navigator.credentials.get = async (options) => {
      globalThis.window.passkeyAuthenticatorStats.starts += 1

      options?.signal?.addEventListener('abort', () => {
        globalThis.window.passkeyAuthenticatorStats.aborts += 1
      })

      return original(options)
    }
  })
}

async function getPasskeyAuthenticatorStarts(page: Page): Promise<number> {
  return page.evaluate(() => globalThis.window.passkeyAuthenticatorStats.starts)
}

async function getPasskeyAuthenticatorAborts(page: Page): Promise<number> {
  return page.evaluate(() => globalThis.window.passkeyAuthenticatorStats.aborts)
}

// The virtual authenticators perform real WebAuthn; API fixtures verify their signatures.
test.describe('passkeys', () => {
  test('manages two keys, signs in with each, and registers again after removal', async ({ page, context }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')

    const first = await addVirtualAuthenticator(session)

    await openPasskeyAccount(page)

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Laptop')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    const list = page.getByRole('list', { name: 'Your passkeys' })

    await expect(list.getByText('Laptop', { exact: true })).toBeVisible()
    await expect(list.getByText('Never used')).toBeVisible()

    const firstCredentials = await session.send('WebAuthn.getCredentials', { authenticatorId: first })

    await session.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: first })

    const second = await addVirtualAuthenticator(session, 'usb')

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Security key')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(list.getByRole('listitem')).toHaveCount(2)

    await list.getByRole('listitem').filter({ hasText: 'Laptop' }).getByRole('button', {
      name: 'Rename Laptop',
      exact: true
    }).click()

    const rename = page.getByRole('dialog', { name: 'Rename passkey' })

    await rename.getByRole('textbox', { name: 'Passkey name' }).fill('Travel laptop')
    await rename.getByRole('textbox', { name: 'Passkey name' }).press('Enter')
    await expect(rename).not.toBeVisible()
    await expect(list.getByText('Travel laptop', { exact: true })).toBeVisible()

    await page.getByRole('button', {
      name: 'Log out',
      exact: true
    }).click()

    await page.goto('/login?redirectTo=/account')
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()

    await expect(page.getByRole('heading', {
      name: 'Account',
      exact: true
    })).toBeVisible()

    await session.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: second })

    const restored = await addVirtualAuthenticator(session)
    const firstCredential = required(firstCredentials.credentials.at(0))

    await session.send('WebAuthn.addCredential', {
      authenticatorId: restored,
      credential: firstCredential
    })

    await page.getByRole('button', {
      name: 'Log out',
      exact: true
    }).click()

    await page.goto('/login?redirectTo=/account')
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()

    await expect(page.getByRole('heading', {
      name: 'Account',
      exact: true
    })).toBeVisible()

    const laptop = list.getByRole('listitem').filter({ hasText: 'Travel laptop' })

    await laptop.getByRole('button', {
      name: 'Remove Travel laptop',
      exact: true
    }).click()

    const removal = page.getByRole('dialog', { name: 'Remove passkey' })

    await removal.getByRole('button', { name: 'Cancel' }).click()
    await expect(laptop).toBeVisible()

    await laptop.getByRole('button', {
      name: 'Remove Travel laptop',
      exact: true
    }).click()

    await removal.getByRole('button', {
      name: 'Remove passkey',
      exact: true
    }).click()

    await expect(laptop).toHaveCount(0)

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Laptop again')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(list.getByText('Laptop again', { exact: true })).toBeVisible()
  })

  test('names each key action and shows creation and last-used times', async ({ page }) => {
    const { items } = await mockPasskeyAccount(page)
    const createdAt = '2026-09-24T10:15:00.000Z'
    const lastUsedAt = '2026-09-24T14:45:00.000Z'

    items.push({
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d1',
      name: 'Laptop',
      createdAt,
      lastUsedAt
    }, {
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d2',
      name: 'Security key',
      createdAt,
      lastUsedAt: null
    })

    await openPasskeyAccount(page)

    const list = page.getByRole('list', { name: 'Your passkeys' })
    const laptop = list.getByRole('listitem').filter({ hasText: 'Laptop' })
    const securityKey = list.getByRole('listitem').filter({ hasText: 'Security key' })
    const createdTime = await page.evaluate(value => new Date(value).toLocaleTimeString(undefined, { timeStyle: 'short' }), createdAt)
    const lastUsedTime = await page.evaluate(value => new Date(value).toLocaleTimeString(undefined, { timeStyle: 'short' }), lastUsedAt)

    await expect(laptop.getByText(/^Added /u)).toContainText(createdTime)
    await expect(laptop.getByText(/^Last used /u)).toContainText(lastUsedTime)
    await expect(securityKey.getByText('Never used')).toBeVisible()

    await expect(laptop.getByRole('button', {
      name: 'Rename Laptop',
      exact: true
    })).toBeVisible()

    await expect(laptop.getByRole('button', {
      name: 'Remove Laptop',
      exact: true
    })).toBeVisible()

    await expect(securityKey.getByRole('button', {
      name: 'Rename Security key',
      exact: true
    })).toBeVisible()

    await expect(securityKey.getByRole('button', {
      name: 'Remove Security key',
      exact: true
    })).toBeVisible()
  })

  test('rejects an assertion with an invalid signature without signing in', async ({ page, context }) => {
    const mock = await mockPasskeyAccount(page)
    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')
    await addVirtualAuthenticator(session)
    await openPasskeyAccount(page)

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Signature test key')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(page.getByRole('list', { name: 'Your passkeys' }).getByText('Signature test key')).toBeVisible()

    await page.getByRole('button', {
      name: 'Log out',
      exact: true
    }).click()

    mock.invalidateNextAuthenticationSignature()
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
    await expect(page.getByRole('alert')).toHaveText('Could not verify the passkey. Try again.')
    await expect(page).toHaveURL(/\/login$/u)
  })

  test('aborts registration options, preserves the name and focus, then retries', async ({ page, context }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')
    await addVirtualAuthenticator(session)

    const started = createDeferred()
    const release = createDeferred()

    await page.route('**/api/account/passkeys/registration/options', async () => {
      started.resolve()

      await release.promise
    })

    await openPasskeyAccount(page)

    const input = page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    })

    await input.fill('Keep this name')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await started.promise

    const failed = page.waitForEvent('requestfailed', request => request.url().endsWith('/passkeys/registration/options'))

    await page.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    const aborted = await failed

    expect(aborted.failure()?.errorText).toBe('net::ERR_ABORTED')
    release.resolve()
    await expect(input).toHaveValue('Keep this name')
    await expect(input).toBeFocused()
    await page.unroute('**/api/account/passkeys/registration/options')

    // Reinstall the fixture after the aborted ceremony; no authenticator credential was created.
    await mockPasskeyAccount(page)

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(page.getByRole('list', { name: 'Your passkeys' }).getByText('Keep this name')).toBeVisible()
  })

  test('aborts a pending authenticator registration and retries', async ({ page, context }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')

    const authenticatorId = await addVirtualAuthenticator(session)

    await session.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId,
      enabled: false
    })

    await page.addInitScript(() => {
      const original = globalThis.navigator.credentials.create.bind(globalThis.navigator.credentials)

      globalThis.window.passkeyAuthenticatorStats = {
        aborts: 0,
        starts: 0
      }

      globalThis.navigator.credentials.create = async (options) => {
        globalThis.window.passkeyAuthenticatorStats.starts += 1

        options?.signal?.addEventListener('abort', () => {
          globalThis.window.passkeyAuthenticatorStats.aborts += 1
        })

        return original(options)
      }
    })

    await openPasskeyAccount(page)

    const input = page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    })

    await input.fill('Cancel and retry')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(1)

    await page.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect.poll(async () => getPasskeyAuthenticatorAborts(page)).toBe(1)
    await expect(input).toHaveValue('Cancel and retry')
    await expect(input).toBeFocused()
    await expect(page.getByRole('list', { name: 'Your passkeys' }).getByRole('listitem')).toHaveCount(0)

    await session.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId,
      enabled: true
    })

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(page.getByRole('list', { name: 'Your passkeys' }).getByText('Cancel and retry')).toBeVisible()
  })

  test('refreshes saved keys when the registration response is lost', async ({ page, context }) => {
    const mock = await mockPasskeyAccount(page)
    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')
    await addVirtualAuthenticator(session)
    await openPasskeyAccount(page)
    mock.loseNextRegistrationResponse()

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Saved once')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(page.getByRole('list', { name: 'Your passkeys' }).getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText('Saved once', { exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Check the refreshed list')
  })

  test('recovers once when registration and list responses are both lost', async ({ page, context }) => {
    const mock = await mockPasskeyAccount(page)
    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')
    await addVirtualAuthenticator(session)
    await openPasskeyAccount(page)

    const retryStarted = createDeferred()
    const releaseRetry = createDeferred()
    let listRequestCount = 0

    await page.route('**/api/account/passkeys', async (route) => {
      listRequestCount += 1

      // oxlint-disable-next-line vitest/no-conditional-in-test -- The retry must get a successful response after failed reconciliation.
      if (listRequestCount === 1) {
        await route.fulfill({
          status: 503,
          json: {}
        })

        return
      }

      retryStarted.resolve()

      await releaseRetry.promise

      await route.fulfill({
        json: {
          items: mock.items,
          canRegister: true
        }
      })
    })

    mock.loseNextRegistrationResponse()

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Recovered key')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    const loadAlert = page.getByRole('alert')
    const retry = page.getByRole('button', { name: 'Retry' })

    await expect(loadAlert).toHaveCount(1)

    await expect(loadAlert.getByText(
      'The passkey may have been added, but the list could not be reloaded. Retry before adding it again.',
      { exact: true }
    )).toBeVisible()

    await expect(page.getByText('Check the refreshed list')).toHaveCount(0)
    await retry.click()

    await retryStarted.promise

    await expect(retry).toBeFocused()
    await expect(page.getByText('Loading passkeys…', { exact: true })).toBeVisible()
    releaseRetry.resolve()

    const completion = page.getByText('Passkeys loaded.', { exact: true })

    await expect(loadAlert).toHaveCount(0)
    await expect(completion).toHaveCount(1)
    await expect(completion).toBeFocused()
    await expect(page.getByText('Recovered key', { exact: true })).toBeVisible()
  })

  test('blocks competing methods during verification and retries with fresh options', async ({ page, context }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')
    await addVirtualAuthenticator(session)
    await openPasskeyAccount(page)

    await page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    }).fill('Laptop')

    await page.getByRole('button', {
      name: 'Add passkey',
      exact: true
    }).click()

    await expect(page.getByText('Laptop', { exact: true })).toBeVisible()

    await page.getByRole('button', {
      name: 'Log out',
      exact: true
    }).click()

    await page.goto('/login?redirectTo=/account')

    const started = createDeferred()
    const release = createDeferred()

    await page.route('**/api/auth/passkeys/verify', async (route) => {
      started.resolve()

      await release.promise

      await route.fulfill({
        status: 401,
        json: {}
      })
    })

    const firstOptions = page.waitForResponse('**/api/auth/passkeys/options')

    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()

    const first = await firstOptions
    const firstBody = await first.text()

    await started.promise

    await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeDisabled()
    await expect(page.getByRole('button', { name: /Twitch/u })).toBeDisabled()

    await expect(page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })).toBeDisabled()

    release.resolve()
    await expect(page.getByRole('alert')).toContainText('Could not verify the passkey')
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeFocused()

    const nextOptions = page.waitForResponse('**/api/auth/passkeys/options')

    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()

    const next = await nextOptions

    expect(await next.text()).not.toBe(firstBody)
    await expect(page.getByRole('alert')).toContainText('Could not verify the passkey')
  })

  test('keeps long names and keyboard controls inside a narrow screen', async ({ page, context }) => {
    await page.setViewportSize({
      width: 320,
      height: 720
    })

    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')
    await addVirtualAuthenticator(session)
    await openPasskeyAccount(page)

    const name = 'MyTravelSecurityKey'.repeat(3)

    const input = page.getByRole('textbox', {
      name: 'Passkey name',
      exact: true
    })

    await input.fill(name)
    await input.press('Enter')

    const item = page.getByRole('listitem').filter({ hasText: name })

    await expect(item).toBeVisible()

    const bounds = required(await item.boundingBox())

    expect(bounds).not.toBeNull()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)

    const rename = item.getByRole('button', {
      name: `Rename ${name}`,
      exact: true
    })

    await rename.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Rename passkey' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(rename).toBeFocused()
  })

  test('aborts a pending explicit authenticator when switching to Guest', async ({ page, context, turnstile }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')

    const authenticatorId = await addVirtualAuthenticator(session)

    await session.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId,
      enabled: false
    })

    await trackPasskeyAuthenticator(page)
    await turnstile.pause(page)
    await page.goto('/login')
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click()
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(1)
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await expect.poll(async () => getPasskeyAuthenticatorAborts(page)).toBe(1)
    await expect(page.getByRole('button', { name: 'Close security check' })).toBeVisible()
    await page.getByRole('button', { name: 'Close security check' }).click()
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeEnabled()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('shows cancellation feedback and allows retry after an explicit native prompt is canceled', async ({ page }) => {
    await mockPasskeyAccount(page)

    await page.addInitScript(() => {
      globalThis.window.passkeyAuthenticatorStats = {
        aborts: 0,
        starts: 0
      }

      // oxlint-disable-next-line typescript/require-await -- The Credentials API mock must return a rejected promise.
      globalThis.navigator.credentials.get = async () => {
        globalThis.window.passkeyAuthenticatorStats.starts += 1

        throw new globalThis.DOMException('The operation was canceled.', 'NotAllowedError')
      }
    })

    await page.goto('/login')

    const passkeyButton = page.getByRole('button', { name: 'Sign in with a passkey' })

    await passkeyButton.click()
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(1)
    await expect(page.getByRole('alert')).toHaveText('Passkey request was cancelled or timed out. You can try again.')
    await expect(passkeyButton).toBeFocused()
    await expect(passkeyButton).toBeEnabled()
    await passkeyButton.click()
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(2)
    await expect(page.getByRole('alert')).toHaveText('Passkey request was cancelled or timed out. You can try again.')
  })
})

test.describe('conditional passkeys', () => {
  test.use({ conditionalPasskeys: true })

  test('re-arms the native conditional authenticator after a Guest security check is canceled', async ({ page, context, turnstile }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')

    const authenticatorId = await addVirtualAuthenticator(session)

    await session.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId,
      enabled: false
    })

    await trackPasskeyAuthenticator(page)
    await turnstile.pause(page)
    await page.goto('/login')
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(1)
    await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeEnabled()
    await page.getByRole('button', { name: 'Continue as guest' }).click()
    await expect.poll(async () => getPasskeyAuthenticatorAborts(page)).toBe(1)
    await page.getByRole('button', { name: 'Close security check' }).click()
    await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeFocused()
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(2)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test('re-arms conditional autofill after an Email request fails', async ({ page, context, turnstile }) => {
    await mockPasskeyAccount(page)

    const session = await context.newCDPSession(page)

    await session.send('WebAuthn.enable')

    const authenticatorId = await addVirtualAuthenticator(session)

    await session.send('WebAuthn.setAutomaticPresenceSimulation', {
      authenticatorId,
      enabled: false
    })

    await page.route('**/api/auth/email/sign-in', async route => route.fulfill({
      status: 503,
      json: {}
    }))

    await trackPasskeyAuthenticator(page)
    await turnstile.pauseAutomatically(page)
    await page.goto('/login')
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(1)

    await page.getByRole('textbox', {
      name: 'Email',
      exact: true
    }).fill('walker@example.com')

    await page.getByLabel('Password', { exact: true }).fill('a correct long passphrase')

    await page.getByRole('button', {
      name: 'Sign in',
      exact: true
    }).click()

    await expect.poll(async () => getPasskeyAuthenticatorAborts(page)).toBe(1)
    await turnstile.complete(page)
    await expect(page.getByRole('alert')).toHaveText('Sign in is temporarily unavailable. Try again.')

    await expect(page.getByRole('button', {
      name: 'Sign in',
      exact: true
    })).toBeFocused()

    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(2)
  })

  test('rearms conditional autofill on a later email focus without an automatic retry', async ({ page }) => {
    await mockPasskeyAccount(page)

    await page.addInitScript(() => {
      globalThis.window.passkeyAuthenticatorStats = {
        aborts: 0,
        starts: 0
      }

      // oxlint-disable-next-line typescript/require-await -- The Credentials API mock must return a rejected promise.
      globalThis.navigator.credentials.get = async () => {
        globalThis.window.passkeyAuthenticatorStats.starts += 1

        throw new globalThis.DOMException('The operation was canceled.', 'NotAllowedError')
      }
    })

    await page.goto('/login')
    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(1)
    await expect(page.getByRole('button', { name: 'Sign in with a passkey' })).toBeEnabled()
    await page.waitForTimeout(100)
    expect(await getPasskeyAuthenticatorStarts(page)).toBe(1)
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: 'Sign in with a passkey' }).focus()

    await page.getByRole('textbox', {
      name: 'Email',
      exact: true
    }).focus()

    await expect.poll(async () => getPasskeyAuthenticatorStarts(page)).toBe(2)
    await page.waitForTimeout(100)
    expect(await getPasskeyAuthenticatorStarts(page)).toBe(2)
  })

  for (const method of ['email', 'guest', 'twitch', 'explicit', 'navigation'] as const) {
    test(`cancels pending options when choosing ${method}`, async ({ page, turnstile }) => {
      const started = createDeferred()
      const release = createDeferred()

      await page.route('**/api/auth/passkeys/options', async () => {
        started.resolve()

        await release.promise
      })

      await turnstile.pauseAutomatically(page)
      await page.route('**/api/oauth/twitch?**', async route => route.fulfill({ status: 204 }))
      await page.goto('/login')

      await started.promise

      await expect(page.getByRole('textbox', {
        name: 'Email',
        exact: true
      })).toHaveAttribute('autocomplete', 'username webauthn')

      await expect(page.getByRole('button', { name: 'Continue as guest' })).toBeEnabled()

      const failed = page.waitForEvent('requestfailed', request => request.url().endsWith('/auth/passkeys/options'))

      await switchActions[method](page)

      const aborted = await failed

      expect(aborted.failure()?.errorText).toBe('net::ERR_ABORTED')
      release.resolve()
    })
  }
})
