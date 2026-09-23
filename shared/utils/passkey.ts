const passkeyMessages = {
  invalid: 'Could not verify the passkey. Try again.',
  unavailable: 'Passkeys are temporarily unavailable. Try again.',
  tooManyAttempts: 'Too many passkey attempts. Try again in a minute.',
  duplicate: 'This passkey is already registered. Use another authenticator.',
  durableAccountRequired: 'Add a verified email or connect Twitch before adding a passkey.',
  alreadySignedIn: 'A user is already signed in. Reload the page to continue.',
  cancelled: 'Passkey request was cancelled or timed out. You can try again.',
  unsupported: 'Passkeys are not available in this browser. Use another sign-in method.'
} as const

export { passkeyMessages }
