import { getFetchErrorResponse } from './fetch-error'

interface PasswordRecoveryError {
  kind: 'compromised-password' | 'generic' | 'invalid-link';
  message: string;
}

function getPasswordRecoveryRequestError(error: unknown): string {
  const { status } = getFetchErrorResponse(error)

  if (status === 403) {
    return 'Security check failed. Try again.'
  } else if (status === 429) {
    return 'Too many recovery attempts. Try again in a minute.'
  } else if (status === 503) {
    return 'Password recovery is temporarily unavailable. Try again.'
  }

  return 'Could not request a password reset. Try again.'
}

function getPasswordRecoveryResetError(error: unknown): PasswordRecoveryError {
  const { status, statusMessage } = getFetchErrorResponse(error)
  const isInvalidLink = status === 400 && statusMessage === 'The password reset link is invalid or expired'
  const isCompromisedPassword = status === 400 && statusMessage === 'Choose a password that has not appeared in a data breach'

  if (isInvalidLink) {
    return {
      kind: 'invalid-link',
      message: 'This password reset link is invalid or expired.'
    }
  } else if (isCompromisedPassword) {
    return {
      kind: 'compromised-password',
      message: 'Choose a password that has not appeared in a data breach.'
    }
  } else if (status === 403) {
    return {
      kind: 'generic',
      message: 'Security check failed. Try again.'
    }
  } else if (status === 429) {
    return {
      kind: 'generic',
      message: 'Too many recovery attempts. Try again in a minute.'
    }
  } else if (status === 503) {
    return {
      kind: 'generic',
      message: 'Password recovery is temporarily unavailable. Try again.'
    }
  }

  return {
    kind: 'generic',
    message: 'Could not reset your password. Try again.'
  }
}

export { getPasswordRecoveryRequestError, getPasswordRecoveryResetError }
