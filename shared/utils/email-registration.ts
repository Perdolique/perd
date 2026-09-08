const emailRegistrationApiPaths = ['/api/auth/email/registration', '/api/auth/email/registration/verify'] as const
const minimumPasswordLength = 15
const maximumPasswordLength = 128

function isEmailRegistrationEnabled(value: unknown): boolean {
  return value === true || value === 'true'
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isRegistrationPasswordValid(password: string): boolean {
  // Each Unicode code point uses at most two UTF-16 code units; bound allocation before counting.
  if (password.length > maximumPasswordLength * 2) {
    return false
  }

  // Unicode code points, rather than grapheme clusters, define the password length contract.
  // oxlint-disable-next-line unicorn/prefer-spread -- Avoid the conflicting no-misused-spread rule on strings.
  const characters = Array.from(password)
  const { length } = characters

  return length >= minimumPasswordLength && length <= maximumPasswordLength
}

export {
  emailRegistrationApiPaths,
  isEmailRegistrationEnabled,
  isRegistrationPasswordValid,
  normalizeEmail
}
