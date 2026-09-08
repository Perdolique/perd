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
  if (error !== null && typeof error === 'object') {
    const data: unknown = Reflect.get(error, 'data')

    if (data !== null && typeof data === 'object') {
      const status: unknown = Reflect.get(data, 'statusCode')
      const message: unknown = Reflect.get(data, 'statusMessage')

      if (status === 429) {
        return 'Too many attempts. Try again in a minute.'
      }

      if (status === 403) {
        return 'Security check failed. Try again.'
      }

      if (typeof message === 'string' && registrationMessages.has(message)) {
        return message
      }
    }
  }

  return 'Could not complete email verification. Try again.'
}

export { getEmailRegistrationError }
