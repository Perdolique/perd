import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential
} from '@simplewebauthn/server'

import { decodeClientDataJSON, isoBase64URL } from '@simplewebauthn/server/helpers'
import { hashToken } from './password'
import { PasskeyVerificationError } from './passkey-request'
import type { PasskeyChallenge } from './passkey-challenges'

const passkeyAlgorithms = [-7, -257, -8]

function addPasskeySensitiveValues(value: unknown, sensitiveValues: string[]): void {
  if (typeof value === 'string') {
    sensitiveValues.push(value)
  } else if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      addPasskeySensitiveValues(child, sensitiveValues)
    }
  }
}

function validatePasskeyClientData(clientDataJSON: string, sensitiveValues: string[]): void {
  const clientData = decodeClientDataJSON(clientDataJSON)

  sensitiveValues.push(clientData.challenge)

  if (clientData.crossOrigin === true) {
    throw new Error('Cross-origin passkey ceremonies are not allowed')
  }
}

async function verifyPasskeyRegistration(
  credential: RegistrationResponseJSON,
  challenge: PasskeyChallenge,
  sensitiveValues: string[]
) {
  addPasskeySensitiveValues(credential, sensitiveValues)

  try {
    validatePasskeyClientData(credential.response.clientDataJSON, sensitiveValues)

    if (credential.clientExtensionResults.credProps?.rk === false) {
      throw new Error('Discoverable credentials are required')
    }

    const result = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: value => hashToken(value) === challenge.challengeHash,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpId,
      requireUserPresence: true,
      requireUserVerification: true,
      supportedAlgorithmIDs: passkeyAlgorithms
    })

    if (!result.verified) {
      throw new Error('Passkey registration verification failed')
    }

    return result.registrationInfo
  } catch (error) {
    throw new PasskeyVerificationError('Passkey registration was rejected', { cause: error })
  }
}

async function verifyPasskeyAuthentication(
  response: AuthenticationResponseJSON,
  credential: WebAuthnCredential,
  context: { challenge: PasskeyChallenge; sensitiveValues: string[]; }
) {
  const { challenge, sensitiveValues } = context

  addPasskeySensitiveValues(response, sensitiveValues)
  sensitiveValues.push(isoBase64URL.fromBuffer(credential.publicKey))

  try {
    validatePasskeyClientData(response.response.clientDataJSON, sensitiveValues)

    const result = await verifyAuthenticationResponse({
      response,
      credential,
      expectedChallenge: value => hashToken(value) === challenge.challengeHash,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rpId,
      requireUserVerification: true
    })

    if (!result.verified) {
      throw new Error('Passkey signature is invalid')
    }

    return result.authenticationInfo
  } catch (error) {
    throw new PasskeyVerificationError('Passkey authentication was rejected', { cause: error })
  }
}

export { addPasskeySensitiveValues, passkeyAlgorithms, verifyPasskeyAuthentication, verifyPasskeyRegistration }
