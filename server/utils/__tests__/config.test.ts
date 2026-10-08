import { describe, expect, it, vi } from 'vitest'
import { getRuntimeTurnstileConfig } from '#server/utils/config'

const { useRuntimeConfigMock } = vi.hoisted(() => {
  return {
    useRuntimeConfigMock: vi.fn()
  }
})

vi.mock(import('nuxt/server'), async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    useRuntimeConfig: useRuntimeConfigMock
  }
})

describe(getRuntimeTurnstileConfig, () => {
  it('should read private Turnstile values from the runtime config', () => {
    useRuntimeConfigMock.mockReturnValue({
      public: {
        turnstileSiteKey: 'public-site-key'
      },

      turnstile: {
        hostnames: 'metsik.app',
        secret: 'private-secret'
      }
    })

    const config = getRuntimeTurnstileConfig()

    expect(useRuntimeConfigMock).toHaveBeenCalledWith()
    expect(config.secret).toBe('private-secret')
    expect(config.hostnames).toStrictEqual(new Set(['metsik.app']))
    expect(config.isTestMode).toBe(false)
  })
})
