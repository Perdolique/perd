const emailRegistrationApiPaths = ['/api/auth/email/registration', '/api/auth/email/registration/verify'] as const

function isEmailRegistrationEnabled(value: unknown): boolean {
  return value === true || value === 'true'
}

export {
  emailRegistrationApiPaths,
  isEmailRegistrationEnabled
}
