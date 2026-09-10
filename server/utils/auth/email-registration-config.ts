import { createError } from 'h3'
import * as v from 'valibot'
import { normalizeEmail } from '#shared/utils/email-registration'

interface EmailRegistrationConfig {
  origin: string;
  stagingRecipient: string | null;
}

interface EmailRegistrationSettings {
  origin: string;
  environment: string;
  stagingRecipient: string;
}

function validateEmailAuthenticationOrigin(emailRegistration: EmailRegistrationSettings): string {
  const { origin, environment } = emailRegistration
  const isLocal = environment === 'development'
  const isKnownEnvironment = isLocal || environment === 'staging' || environment === 'production'

  try {
    const url = new URL(origin)
    const isAllowedProtocol = url.protocol === 'https:' || (isLocal && url.protocol === 'http:')

    if (!isKnownEnvironment || !isAllowedProtocol || url.origin !== origin) {
      throw new Error('Invalid authentication origin or environment')
    }

    return origin
  } catch {
    throw createError({
      status: 503,
      statusMessage: 'Email authentication is not configured'
    })
  }
}

function validateEmailRegistrationConfig(emailRegistration: EmailRegistrationSettings): EmailRegistrationConfig {
  const { environment, stagingRecipient } = emailRegistration
  const isStaging = environment === 'staging'

  try {
    const origin = validateEmailAuthenticationOrigin(emailRegistration)
    const recipient = isStaging ? normalizeEmail(stagingRecipient) : null

    if (isStaging && !v.is(v.pipe(v.string(), v.email()), recipient)) {
      throw new Error('Staging registration requires a verified destination')
    }

    return {
      origin,
      stagingRecipient: recipient
    }
  } catch {
    throw createError({
      status: 503,
      statusMessage: 'Email registration is not configured'
    })
  }
}

export type { EmailRegistrationConfig }
export { validateEmailAuthenticationOrigin, validateEmailRegistrationConfig }
