import type { Page, CDPSession } from '@playwright/test'

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type WebAuthnCredential
} from '@simplewebauthn/server'

import { isoBase64URL } from '@simplewebauthn/server/helpers'

import {
  validatePasskeyAuthentication,
  validatePasskeyName,
  validatePasskeyRegistration
} from '../../../server/utils/validation/schemas'

import type { PasskeySummary } from '../../../shared/types/passkey'
import { expect, waitForInitialEmailSignInTurnstile } from './global.fixtures'
import { appBaseUrl } from '../constants'

const account = {
  userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477dd',
  email: 'walker@example.com',
  isAdmin: false,
  isGuest: false,
  isTwitchLinked: false
} as const

function createTestId() {
  const id = globalThis.crypto.randomUUID()

  return `${id.slice(0, 14)}7${id.slice(15)}`
}

async function mockPasskeyAccount(page: Page) {
  const items: PasskeySummary[] = []
  const credentials = new Map<string, WebAuthnCredential>()
  const randomHandle = globalThis.crypto.getRandomValues(new Uint8Array(32))
  const userHandle = isoBase64URL.fromBuffer(randomHandle)
  let activeRegistration: { id: string; challenge: string; name: string; } | null = null
  let activeAuthentication: { id: string; challenge: string; } | null = null
  let signedIn = true
  let loseRegistrationResponse = false
  let invalidateNextAuthentication = false

  await page.route('**/api/user', async (route) => {
    const responseUser = signedIn ? account : {
      ...account,
      userId: null
    }

    await route.fulfill({ json: responseUser })
  })

  await page.route('**/api/auth/create-session', async (route) => {
    signedIn = true

    await route.fulfill({
      status: 201,
      json: account
    })
  })

  await page.route('**/api/auth/logout', async (route) => {
    signedIn = false

    await route.fulfill({ status: 204 })
  })

  await page.route('**/api/account/passkeys', async route => route.fulfill({ json: {
    items,
    canRegister: true
  } }))

  await page.route('**/api/account/passkeys/*', async (route) => {
    const id = new globalThis.URL(route.request().url()).pathname.split('/').at(-1)
    const index = items.findIndex(item => item.id === id)
    const item = items.at(index)

    if (item === undefined) {
      await route.fulfill({ status: 404 })

      return
    }

    if (route.request().method() === 'DELETE') {
      credentials.delete(item.id)
      items.splice(index, 1)
      await route.fulfill({ status: 204 })

      return
    }

    const raw: unknown = route.request().postDataJSON()
    const body = validatePasskeyName(raw)

    if (body === false) {
      throw new Error('Invalid rename payload')
    }

    item.name = body.name

    await route.fulfill({ json: item })
  })

  await page.route('**/api/account/passkeys/registration/options', async (route) => {
    const raw: unknown = route.request().postDataJSON()
    const body = validatePasskeyName(raw)

    if (body === false) {
      throw new Error('Invalid registration name')
    }

    const excludedCredentials = Array.from(credentials.values(), (credential) => {
      return { id: credential.id }
    })

    const options = await generateRegistrationOptions({
      rpName: 'Metsik',
      rpID: 'localhost',
      userID: isoBase64URL.toBuffer(userHandle),
      userName: account.email,
      attestationType: 'none',

      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required'
      },

      excludeCredentials: excludedCredentials
    })

    activeRegistration = {
      id: createTestId(),
      challenge: options.challenge,
      name: body.name
    }

    await route.fulfill({ json: {
      ceremonyId: activeRegistration.id,
      options
    } })
  })

  await page.route('**/api/account/passkeys/registration/verify', async (route) => {
    const raw: unknown = route.request().postDataJSON()
    const body = validatePasskeyRegistration(raw)
    const ceremony = activeRegistration

    activeRegistration = null

    if (body === false || ceremony === null || ceremony.id !== body.ceremonyId) {
      throw new Error('Invalid registration ceremony')
    }

    const result = await verifyRegistrationResponse({
      response: body.credential,
      expectedChallenge: ceremony.challenge,
      expectedOrigin: appBaseUrl,
      expectedRPID: 'localhost',
      requireUserVerification: true
    })

    const metadata = {
      id: createTestId(),
      name: ceremony.name,
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    }

    if (!result.verified) {
      throw new Error('Registration failed verification')
    }

    credentials.set(metadata.id, result.registrationInfo.credential)
    items.push(metadata)

    if (loseRegistrationResponse) {
      loseRegistrationResponse = false

      await route.abort('failed')

      return
    }

    await route.fulfill({ json: metadata })
  })

  await page.route('**/api/auth/passkeys/options', async (route) => {
    const options = await generateAuthenticationOptions({
      rpID: 'localhost',
      userVerification: 'required',
      allowCredentials: []
    })

    activeAuthentication = {
      id: createTestId(),
      challenge: options.challenge
    }

    await route.fulfill({ json: {
      ceremonyId: activeAuthentication.id,
      options
    } })
  })

  await page.route('**/api/auth/passkeys/verify', async (route) => {
    const raw: unknown = route.request().postDataJSON()
    const body = validatePasskeyAuthentication(raw)
    const ceremony = activeAuthentication

    activeAuthentication = null

    if (body === false || ceremony === null || ceremony.id !== body.ceremonyId || body.credential.response.userHandle !== userHandle) {
      throw new Error('Invalid sign-in ceremony')
    }

    const credential = [...credentials.values()].find(value => value.id === body.credential.id)

    if (credential === undefined) {
      await route.fulfill({
        status: 401,
        json: {}
      })

      return
    }

    let assertion = body.credential

    if (invalidateNextAuthentication) {
      invalidateNextAuthentication = false

      const signature = isoBase64URL.toBuffer(assertion.response.signature)
      const lastByte = signature.at(-1)

      if (lastByte === undefined) {
        throw new Error('Authentication signature is missing')
      }

      signature[signature.length - 1] = (lastByte + 1) % 256

      assertion = {
        ...assertion,

        response: {
          ...assertion.response,
          signature: isoBase64URL.fromBuffer(signature)
        }
      }
    }

    const result = await verifyAuthenticationResponse({
      response: assertion,
      credential,
      expectedChallenge: ceremony.challenge,
      expectedOrigin: appBaseUrl,
      expectedRPID: 'localhost',
      requireUserVerification: true
    })

    if (!result.verified) {
      await route.fulfill({
        status: 401,
        json: {}
      })

      return
    }

    credential.counter = result.authenticationInfo.newCounter
    signedIn = true

    await route.fulfill({ json: account })
  })

  return {
    items,
    loseNextRegistrationResponse() { loseRegistrationResponse = true },
    invalidateNextAuthenticationSignature() { invalidateNextAuthentication = true }
  }
}

async function openPasskeyAccount(page: Page) {
  await page.goto('/login?redirectTo=/account')
  await waitForInitialEmailSignInTurnstile(page)
  await page.getByRole('button', { name: 'Continue as guest' }).click()

  await expect(page.getByRole('heading', {
    name: 'Account',
    exact: true
  })).toBeVisible()

  await expect(page.getByRole('button', {
    name: 'Add passkey',
    exact: true
  })).toBeEnabled()
}

async function addVirtualAuthenticator(session: CDPSession, transport: 'internal' | 'usb' = 'internal') {
  const { authenticatorId } = await session.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  })

  return authenticatorId
}

export { addVirtualAuthenticator, mockPasskeyAccount, openPasskeyAccount }
