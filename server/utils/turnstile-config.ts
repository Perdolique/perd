import { createError } from 'h3'
import { localTurnstileHostnames, turnstileAlwaysPassSecret } from '#shared/utils/turnstile'

interface TurnstileConfig {
  readonly hostnames: ReadonlySet<string>;
  readonly isTestMode: boolean;
  readonly secret: string;
}

const localHostnameSet = new Set<string>(localTurnstileHostnames)

function createTurnstileConfigError() {
  return createError({
    status: 503,
    statusMessage: 'Turnstile configuration unavailable'
  })
}

function parseTurnstileHostnames(value: unknown): ReadonlySet<string> {
  if (typeof value !== 'string') {
    throw createTurnstileConfigError()
  }

  const hostnames = value
    .split(',')
    .map(hostname => hostname.trim())
    .filter(Boolean)

  if (hostnames.length === 0) {
    throw createTurnstileConfigError()
  }

  return new Set(hostnames)
}

function validateTurnstileConfig(config: unknown): TurnstileConfig {
  if (config === null || typeof config !== 'object') {
    throw createTurnstileConfigError()
  }

  const secret: unknown = Reflect.get(config, 'secret')

  if (typeof secret !== 'string' || secret.trim() === '') {
    throw createTurnstileConfigError()
  }

  const hostnameValue: unknown = Reflect.get(config, 'hostnames')
  const hostnames = parseTurnstileHostnames(hostnameValue)
  const isTestMode = secret === turnstileAlwaysPassSecret
  const hasNonLocalHostname = [...hostnames].some(hostname => !localHostnameSet.has(hostname))

  if (isTestMode && hasNonLocalHostname) {
    throw createTurnstileConfigError()
  }

  return {
    hostnames,
    isTestMode,
    secret
  }
}

export type { TurnstileConfig }

export {
  validateTurnstileConfig
}
