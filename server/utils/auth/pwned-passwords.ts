import { createHash } from 'node:crypto'
import { createError } from 'h3'
import { getAuthErrorDetails } from './telemetry'

async function requestPasswordRange(password: string, sha1: string): Promise<string[]> {
  const prefix = sha1.slice(0, 5)
  const suffix = sha1.slice(5)

  try {
    const signal = AbortSignal.timeout(10_000)

    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal
    })

    if (!response.ok) {
      throw new Error(`Pwned Passwords returned HTTP ${response.status}`)
    }

    const body = await response.text()
    const lines = body.trim().split(/\r?\n/u)

    if (lines.length === 0 || lines.some(line => !/^[\dA-F]{35}:\d+$/u.test(line))) {
      throw new Error('Pwned Passwords returned an invalid range response')
    }

    return lines
  } catch (error) {
    const details = getAuthErrorDetails(error, [password, sha1, suffix])

    console.error('Password screening failed', { error: details })

    throw createError({
      status: 503,
      statusMessage: 'Password checking is temporarily unavailable'
    })
  }
}

async function assertPasswordNotPwned(password: string): Promise<void> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase()
  const suffix = sha1.slice(5)
  const lines = await requestPasswordRange(password, sha1)

  const isPwned = lines.some((line) => {
    const [candidate, count] = line.split(':')

    return candidate === suffix && Number(count) > 0
  })

  if (isPwned) {
    throw createError({
      status: 400,
      statusMessage: 'Choose a password that has not appeared in a data breach'
    })
  }
}

export { assertPasswordNotPwned }
