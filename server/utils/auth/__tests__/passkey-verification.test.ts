import { describe, expect, it, vi } from 'vitest'
import { createVerificationToken, hashToken } from '#server/utils/auth/password'
import type { PasskeyChallenge } from '#server/utils/auth/passkey-challenges'
import { verifyPasskeyAuthentication, verifyPasskeyRegistration } from '#server/utils/auth/passkey-verification'
import { getAuthErrorDetails } from '#server/utils/auth/telemetry'
import { createPasskeyFixture } from '~~/test-utils/passkey'

vi.mock(import('nitropack/runtime'), () => {
  return { useRuntimeConfig: vi.fn() }
})

const rawChallenge = createVerificationToken()

const challenge: PasskeyChallenge = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477dd',
  challengeHash: hashToken(rawChallenge),
  sessionIdHash: hashToken('session'),
  operation: 'authentication',
  userId: null,
  sessionVersion: null,
  name: null,
  origin: 'https://metsik.app',
  rpId: 'metsik.app',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 300_000)
}

describe('passkey verification with real signatures', () => {
  it.each([-7, -257, -8] as const)('registers and verifies algorithm %i', async (algorithm) => {
    const fixture = createPasskeyFixture({ algorithm })
    const registration = await verifyPasskeyRegistration(fixture.registration(rawChallenge), challenge, [])
    const { credential } = registration

    const result = await verifyPasskeyAuthentication(fixture.authentication(rawChallenge), credential, {
      challenge,
      sensitiveValues: []
    })

    expect(result.credentialID).toBe(fixture.credentialId)
    expect(result.userVerified).toBe(true)
    expect(result.newCounter).toBe(0)
  })

  it.each([
    {
      name: 'wrong operation',
      options: { type: 'webauthn.create' }
    },
    {
      name: 'wrong origin',
      options: { origin: 'https://evil.example' }
    },
    {
      name: 'wrong RP',
      options: { rpId: 'evil.example' }
    },
    {
      name: 'missing user presence',
      options: { flags: 4 }
    },
    {
      name: 'missing user verification',
      options: { flags: 1 }
    },
    {
      name: 'cross-origin frame',
      options: { crossOrigin: true }
    }
  ])('rejects $name', async ({ options }) => {
    const fixture = createPasskeyFixture()
    const response = fixture.authentication(rawChallenge, options)

    const credential = {
      id: fixture.credentialId,
      publicKey: fixture.publicKey,
      counter: 0
    }

    await expect(verifyPasskeyAuthentication(response, credential, {
      challenge,
      sensitiveValues: []
    })).rejects.toThrow('Passkey authentication was rejected')
  })

  it('rejects a wrong challenge, tampered signature, and counter regression', async () => {
    const fixture = createPasskeyFixture()

    const credential = {
      id: fixture.credentialId,
      publicKey: fixture.publicKey,
      counter: 1
    }

    await expect(verifyPasskeyAuthentication(fixture.authentication(rawChallenge, { counter: 1 }), credential, {
      challenge,
      sensitiveValues: []
    })).rejects.toThrow(/Passkey .* was rejected/u)

    await expect(verifyPasskeyAuthentication(fixture.authentication(rawChallenge, { counter: 0 }), credential, {
      challenge,
      sensitiveValues: []
    })).rejects.toThrow(/Passkey .* was rejected/u)

    await expect(verifyPasskeyAuthentication(fixture.authentication('wrong-challenge', { counter: 2 }), credential, {
      challenge,
      sensitiveValues: []
    })).rejects.toThrow(/Passkey .* was rejected/u)

    const tampered = fixture.authentication(rawChallenge, { counter: 2 })

    tampered.response.signature = Buffer.alloc(70).toString('base64url')

    await expect(verifyPasskeyAuthentication(tampered, credential, {
      challenge,
      sensitiveValues: []
    })).rejects.toThrow(/Passkey .* was rejected/u)
  })

  it('rejects registration without user verification or discoverability', async () => {
    const fixture = createPasskeyFixture()

    await expect(verifyPasskeyRegistration(fixture.registration(rawChallenge, { flags: 65 }), challenge, [])).rejects.toThrow(/Passkey .* was rejected/u)

    const response = fixture.registration(rawChallenge)

    response.clientExtensionResults.credProps = { rk: false }

    await expect(verifyPasskeyRegistration(response, challenge, [])).rejects.toThrow(/Passkey .* was rejected/u)
  })

  it('keeps verifier diagnostics without leaking the returned challenge or assertion', async () => {
    const fixture = createPasskeyFixture()
    const wrongChallenge = createVerificationToken()
    const response = fixture.authentication(wrongChallenge)
    const sensitiveValues: string[] = []

    const credential = {
      id: fixture.credentialId,
      publicKey: fixture.publicKey,
      counter: 0
    }

    const failure = await verifyPasskeyAuthentication(response, credential, {
      challenge,
      sensitiveValues
    }).catch((error: unknown) => error)

    const details = getAuthErrorDetails(failure, sensitiveValues)
    const logged = JSON.stringify(details)

    expect(failure).toBeInstanceOf(Error)
    expect(logged).toContain('Custom challenge verifier returned false')
    expect(logged).not.toContain(wrongChallenge)
    expect(logged).not.toContain(response.response.clientDataJSON)
    expect(logged).not.toContain(response.response.signature)
    expect(logged).not.toContain(fixture.publicKeyBase64)
  })
})
