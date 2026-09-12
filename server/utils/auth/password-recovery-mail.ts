import type { EmailAuthenticationConfig } from './email-registration-config'

interface PasswordRecoveryEmail {
  email: string;
  redirectTo: string;
  token: string;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

async function sendPasswordRecoveryEmail(
  binding: Env['EMAIL'],
  config: EmailAuthenticationConfig,
  message: PasswordRecoveryEmail
): Promise<void> {
  const url = new URL('/auth/reset-password', config.origin)

  url.searchParams.set('redirectTo', message.redirectTo)

  url.hash = new URLSearchParams({ token: message.token }).toString()

  const link = url.toString()
  const safeLink = escapeHtml(link)

  await binding.send({
    from: 'noreply@metsik.app',
    to: message.email,
    subject: 'Reset your Metsik password',
    text: `Reset your Metsik password: ${link}\n\nThis link expires in one hour. If you did not request this email, ignore it.`,
    html: `<p><a href="${safeLink}">Reset your Metsik password</a>.</p><p>This link expires in one hour.</p><p>If you did not request this email, ignore it.</p>`
  })
}

export { sendPasswordRecoveryEmail }
