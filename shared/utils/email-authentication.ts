const passwordRecoveryApiPaths = ['/api/auth/email/password-recovery', '/api/auth/email/password-recovery/reset'] as const
const minimumPasswordLength = 15
const maximumPasswordLength = 128

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isEmailAuthenticationPasswordValid(password: string): boolean {
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
  isEmailAuthenticationPasswordValid,
  normalizeEmail,
  passwordRecoveryApiPaths
}
