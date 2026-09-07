import { describe, expect, it, vi } from 'vitest'
import { getRuntimeTurnstileConfig } from '#server/utils/config'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { useRuntimeConfigMock } = vi.hoisted(() => {
  return {
    useRuntimeConfigMock: vi.fn()
  }
})

vi.mock(import('nitropack/runtime'), () => {
  return {
    useRuntimeConfig: useRuntimeConfigMock
  }
})

describe(getRuntimeTurnstileConfig, () => {
  it('should read private Turnstile values from the runtime config', () => {
    const event = createTestEvent({})

    useRuntimeConfigMock.mockReturnValue({
      public: {
        turnstileSiteKey: 'public-site-key'
      },

      turnstile: {
        hostnames: 'metsik.app',
        secret: 'private-secret'
      }
    })

    const config = getRuntimeTurnstileConfig(event)

    expect(useRuntimeConfigMock).toHaveBeenCalledWith(event)
    expect(config.secret).toBe('private-secret')
    expect(config.hostnames).toStrictEqual(new Set(['metsik.app']))
    expect(config.isTestMode).toBe(false)
  })
})
