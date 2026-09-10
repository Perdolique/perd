const guestSessionTurnstileAction = 'guest_session'
const emailRegistrationTurnstileAction = 'email_registration'
const emailSignInTurnstileAction = 'email_sign_in'
const turnstileResponseFieldName = 'cf-turnstile-response'
const turnstileAlwaysPassSiteKey = '1x00000000000000000000AA'
const turnstileAlwaysPassSecret = '1x0000000000000000000000000000000AA'

const localTurnstileHostnames = [
  'localhost',
  '127.0.0.1'
] as const

export {
  emailRegistrationTurnstileAction,
  emailSignInTurnstileAction,
  guestSessionTurnstileAction,
  localTurnstileHostnames,
  turnstileAlwaysPassSecret,
  turnstileAlwaysPassSiteKey,
  turnstileResponseFieldName
}
