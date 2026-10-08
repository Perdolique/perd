import * as v from 'valibot'
import type { passkeyAuthenticationSchema, passkeyRegistrationSchema } from '#server/utils/validation/schemas'

type BrowserCredential = AuthenticationResponseJSON | RegistrationResponseJSON
type RegistrationCredential = v.InferInput<typeof passkeyRegistrationSchema>['credential']
type AuthenticationCredential = v.InferInput<typeof passkeyAuthenticationSchema>['credential']

const attachmentSchema = v.optional(v.picklist(['platform', 'cross-platform']))
const transportSchema = v.array(v.picklist(['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb']))
const credentialTypeSchema = v.literal('public-key')

/** Narrows native browser JSON to the registration API contract. */
function getPasskeyRegistrationCredential(credential: BrowserCredential): RegistrationCredential {
  const { response } = credential

  if (!('attestationObject' in response)) {
    throw new Error('Passkey registration returned an invalid credential')
  }

  const type = v.parse(credentialTypeSchema, credential.type)
  const authenticatorAttachment = v.parse(attachmentSchema, credential.authenticatorAttachment)
  const transports = v.parse(transportSchema, response.transports)

  return {
    id: credential.id,
    rawId: credential.rawId,
    type,
    authenticatorAttachment,
    clientExtensionResults: credential.clientExtensionResults,

    response: {
      clientDataJSON: response.clientDataJSON,
      attestationObject: response.attestationObject,
      transports
    }
  }
}

/** Narrows native browser JSON to the discoverable-credential sign-in contract. */
function getPasskeyAuthenticationCredential(credential: BrowserCredential): AuthenticationCredential {
  const { response } = credential

  if (!('signature' in response) || response.userHandle === undefined) {
    throw new Error('Passkey authentication returned an invalid credential')
  }

  const type = v.parse(credentialTypeSchema, credential.type)
  const authenticatorAttachment = v.parse(attachmentSchema, credential.authenticatorAttachment)

  return {
    id: credential.id,
    rawId: credential.rawId,
    type,
    authenticatorAttachment,
    clientExtensionResults: credential.clientExtensionResults,

    response: {
      clientDataJSON: response.clientDataJSON,
      authenticatorData: response.authenticatorData,
      signature: response.signature,
      userHandle: response.userHandle
    }
  }
}

export { getPasskeyAuthenticationCredential, getPasskeyRegistrationCredential }
