import { describe, expect, it } from 'vitest'
import { getPasskeyAuthenticationCredential, getPasskeyRegistrationCredential } from '../passkey-credential'

const registration: RegistrationResponseJSON = {
  id: 'credential-id',
  rawId: 'credential-id',
  type: 'public-key',
  authenticatorAttachment: 'platform',
  clientExtensionResults: { credProps: { rk: true } },

  response: {
    clientDataJSON: 'client-data',
    attestationObject: 'attestation',
    authenticatorData: 'authenticator-data',
    publicKeyAlgorithm: -7,
    transports: ['internal', 'hybrid']
  }
}

const authentication: AuthenticationResponseJSON = {
  id: 'credential-id',
  rawId: 'credential-id',
  type: 'public-key',
  clientExtensionResults: {},

  response: {
    clientDataJSON: 'client-data',
    authenticatorData: 'authenticator-data',
    signature: 'signature',
    userHandle: 'user-id'
  }
}

describe('native passkey credentials', () => {
  it('keeps registration fields required by the API', () => {
    expect(getPasskeyRegistrationCredential(registration)).toStrictEqual({
      id: 'credential-id',
      rawId: 'credential-id',
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: { credProps: { rk: true } },

      response: {
        clientDataJSON: 'client-data',
        attestationObject: 'attestation',
        transports: ['internal', 'hybrid']
      }
    })
  })

  it('keeps the discoverable user handle when signing in', () => {
    expect(getPasskeyAuthenticationCredential(authentication)).toStrictEqual({
      ...authentication,
      authenticatorAttachment: undefined
    })
  })

  it('rejects credentials from the other ceremony', () => {
    expect(() => getPasskeyRegistrationCredential(authentication)).toThrow('invalid credential')
    expect(() => getPasskeyAuthenticationCredential(registration)).toThrow('invalid credential')
  })

  it('rejects sign-in without a discoverable user handle', () => {
    const response = {
      clientDataJSON: authentication.response.clientDataJSON,
      authenticatorData: authentication.response.authenticatorData,
      signature: authentication.response.signature
    }

    expect(() => getPasskeyAuthenticationCredential({
      ...authentication,
      response
    })).toThrow('invalid credential')
  })

  it('rejects unsupported browser credential values', () => {
    expect(() => getPasskeyRegistrationCredential({
      ...registration,
      type: 'password'
    })).toThrow('Invalid type')

    expect(() => getPasskeyAuthenticationCredential({
      ...authentication,
      authenticatorAttachment: 'unknown'
    })).toThrow('Invalid type')

    expect(() => getPasskeyRegistrationCredential({
      ...registration,

      response: {
        ...registration.response,
        transports: ['unknown']
      }
    })).toThrow('Invalid type')
  })
})
