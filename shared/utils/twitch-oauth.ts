const twitchOAuthMessages = {
  invalid: 'Twitch sign-in could not be verified. Start again.',
  cancelled: 'Twitch sign-in was cancelled. Start again when you are ready.',
  unavailable: 'Twitch sign-in is temporarily unavailable. Try again.',
  linkingUnavailable: 'Twitch account linking is not available yet.',
  alreadySignedIn: 'A user is already signed in.',
  signInRequired: 'Sign in before connecting Twitch.',
  tooManyAttempts: 'Too many Twitch sign-in attempts. Try again in a minute.'
} as const

export { twitchOAuthMessages }
