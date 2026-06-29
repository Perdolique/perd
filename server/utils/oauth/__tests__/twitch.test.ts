import { describe, expect, it } from 'vitest'
import { validateTwitchOAuthConfig } from '../twitch-config'

describe(validateTwitchOAuthConfig, () => {
  it('should return configured twitch oauth credentials', () => {
    const result = validateTwitchOAuthConfig({
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })

    expect(result).toStrictEqual({
      clientId: 'client-id',
      clientSecret: 'client-secret'
    })
  })

  it.each([
    {},
    {
      clientId: '',
      clientSecret: 'client-secret'
    },
    {
      clientId: 'client-id',
      clientSecret: ''
    }
  ])('should reject incomplete twitch oauth credentials %#', (config) => {
    expect(() => validateTwitchOAuthConfig(config)).toThrow(
      expect.objectContaining({
        statusCode: 500,
        statusMessage: 'Twitch OAuth client credentials are not configured'
      })
    )
  })
})
