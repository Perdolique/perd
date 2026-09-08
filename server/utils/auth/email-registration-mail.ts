import { createError, type H3Event } from 'h3'
import type { EmailRegistrationConfig } from './email-registration-config'

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

interface RegistrationEmail {
  email: string;
  token: string;
  isExistingAccount: boolean;
}

async function sendRegistrationEmail(
  event: H3Event,
  config: EmailRegistrationConfig,
  message: RegistrationEmail
): Promise<void> {
  const { email, token, isExistingAccount } = message
  const binding = event.context.cloudflare?.env.EMAIL

  if (binding === undefined) {
    throw createError({
      status: 503,
      statusMessage: 'Email delivery is temporarily unavailable'
    })
  }

  const url = new URL('/auth/verify-email', config.origin)

  url.hash = new URLSearchParams({ token }).toString()

  const link = url.toString()
  const safeLink = escapeHtml(link)
  const subject = isExistingAccount ? 'Your Metsik account' : 'Verify your Metsik email'

  const text = isExistingAccount
    ? 'This email already belongs to a Metsik account. Your account has not changed. If you did not request this email, you can ignore it.'
    : `Confirm your email and enter the password you chose: ${link}\n\nThis link expires in one hour. If you are adding email to an existing account, open it in the same browser where you started. If you did not request this email, ignore it.`

  const html = isExistingAccount
    ? `<p>${text}</p>`
    : `<p><a href="${safeLink}">Verify your Metsik email</a> and enter the password you chose.</p><p>This link expires in one hour. If you are adding email to an existing account, open it in the same browser where you started.</p><p>If you did not request this email, ignore it.</p>`

  await binding.send({
    from: 'noreply@metsik.app',
    to: email,
    subject,
    text,
    html
  })
}

export { sendRegistrationEmail }
