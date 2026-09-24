import { Buffer } from 'node:buffer'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { isoCBOR } from '@simplewebauthn/server/helpers'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'

interface PasskeyFixtureOptions {
  algorithm?: -7 | -257 | -8;
}

interface PasskeyResponseOptions {
  origin?: string;
  rpId?: string;
  counter?: number;
  flags?: number;
  userHandle?: string;
  crossOrigin?: boolean;
  type?: string;
}

const userPresentFlag = 0x01
const userVerifiedFlag = 0x04
const attestedCredentialDataFlag = 0x40

// oxlint-disable-next-line no-bitwise -- WebAuthn authenticator flags are a bit field.
const authenticationFlags = userPresentFlag | userVerifiedFlag

// oxlint-disable-next-line no-bitwise -- Registration includes attested credential data.
const registrationFlags = authenticationFlags | attestedCredentialDataFlag

function clientData(challenge: string, type: string, responseOptions: PasskeyResponseOptions) {
  const json = JSON.stringify({
    type: responseOptions.type ?? type,
    challenge,
    origin: responseOptions.origin ?? 'https://metsik.app',
    crossOrigin: responseOptions.crossOrigin ?? false
  })

  return Buffer.from(json)
}

function authenticatorData(responseOptions: PasskeyResponseOptions, isRegistration: boolean) {
  const rpIdHash = createHash('sha256').update(responseOptions.rpId ?? 'metsik.app').digest()
  const data = Buffer.alloc(37)

  rpIdHash.copy(data)

  const defaultFlags = isRegistration ? registrationFlags : authenticationFlags

  data[32] = responseOptions.flags ?? defaultFlags

  data.writeUInt32BE(responseOptions.counter ?? 0, 33)

  return data
}

/** Test-only authenticator: library CBOR encoding and Node signatures exercise the real verifier. */
function createPasskeyFixture(options: PasskeyFixtureOptions = {}) {
  const { algorithm = -7 } = options

  // oxlint-disable node/no-sync -- Small test fixtures need a key before building responses.
  const keys = (() => {
    if (algorithm === -7) {
      return generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    }

    if (algorithm === -257) {
      return generateKeyPairSync('rsa', { modulusLength: 2048 })
    }

    return generateKeyPairSync('ed25519')
  })()

  // oxlint-enable node/no-sync
  const jwk = keys.publicKey.export({ format: 'jwk' })
  const credentialBytes = randomBytes(32)
  const credentialId = credentialBytes.toString('base64url')
  const userHandle = randomBytes(32).toString('base64url')
  const coseKey = new Map<number, number | Uint8Array>([[3, algorithm]])

  if (algorithm === -7) {
    coseKey.set(1, 2)
    coseKey.set(-1, 1)
    coseKey.set(-2, Buffer.from(jwk.x ?? '', 'base64url'))
    coseKey.set(-3, Buffer.from(jwk.y ?? '', 'base64url'))
  } else if (algorithm === -257) {
    coseKey.set(1, 3)
    coseKey.set(-1, Buffer.from(jwk.n ?? '', 'base64url'))
    coseKey.set(-2, Buffer.from(jwk.e ?? '', 'base64url'))
  } else {
    coseKey.set(1, 1)
    coseKey.set(-1, 6)
    coseKey.set(-2, Buffer.from(jwk.x ?? '', 'base64url'))
  }

  const publicKey = isoCBOR.encode(coseKey)
  const publicKeyBase64 = Buffer.from(publicKey).toString('base64url')

  function registration(challenge: string, responseOptions: PasskeyResponseOptions = {}): RegistrationResponseJSON {
    const data = authenticatorData(responseOptions, true)
    const credentialLength = Buffer.alloc(2)

    credentialLength.writeUInt16BE(credentialBytes.length)

    const authData = Buffer.concat([data, Buffer.alloc(16), credentialLength, credentialBytes, publicKey])

    const attestation = isoCBOR.encode(new Map<string, string | Map<never, never> | Uint8Array>([
      ['fmt', 'none'],
      ['attStmt', new Map<never, never>()],
      ['authData', authData]
    ]))

    const json = clientData(challenge, 'webauthn.create', responseOptions)

    return {
      id: credentialId,
      rawId: credentialId,
      type: 'public-key',
      clientExtensionResults: { credProps: { rk: true } },

      response: {
        clientDataJSON: json.toString('base64url'),
        attestationObject: Buffer.from(attestation).toString('base64url'),
        transports: ['internal']
      }
    }
  }

  function authentication(challenge: string, responseOptions: PasskeyResponseOptions = {}): AuthenticationResponseJSON {
    const data = authenticatorData(responseOptions, false)
    const json = clientData(challenge, 'webauthn.get', responseOptions)
    const clientHash = createHash('sha256').update(json).digest()
    const signedData = Buffer.concat([data, clientHash])
    const signatureAlgorithm = algorithm === -8 ? null : 'sha256'
    const signature = sign(signatureAlgorithm, signedData, keys.privateKey)

    return {
      id: credentialId,
      rawId: credentialId,
      type: 'public-key',
      clientExtensionResults: {},

      response: {
        clientDataJSON: json.toString('base64url'),
        authenticatorData: data.toString('base64url'),
        signature: signature.toString('base64url'),
        userHandle: responseOptions.userHandle ?? userHandle
      }
    }
  }

  return {
    credentialId,
    publicKey,
    publicKeyBase64,
    userHandle,
    registration,
    authentication
  }
}

export { createPasskeyFixture }
