import { getFetchErrorResponse } from './fetch-error'

const registrationMessages = new Set([
  'Choose a password that has not appeared in a data breach',
  'Password checking is temporarily unavailable',
  'Email registration is not configured',
  'Use the configured staging email address',
  'Return to the browser where you started adding email',
  'This account already has a verified email',
  'Open this link in a signed-out browser to create a new account',
  'The verification link or password is invalid or expired'
])

function getEmailRegistrationError(error: unknown): string {
  const { status, statusMessage } = getFetchErrorResponse(error)

  if (status === 429) {
    return 'Too many attempts. Try again in a minute.'
  }

  if (status === 403) {
    return 'Security check failed. Try again.'
  }

  if (statusMessage !== undefined && registrationMessages.has(statusMessage)) {
    return statusMessage
  }

  return 'Could not complete email verification. Try again.'
}

export { getEmailRegistrationError }
