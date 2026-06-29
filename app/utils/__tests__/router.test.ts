import { describe, expect, it } from 'vitest'
import { getRedirectNavigationTarget, shouldSkipAuth } from '../router'

type AuthRoute = Parameters<typeof shouldSkipAuth>[0]

function createRoute(path: string, meta: AuthRoute['meta'] = {}): AuthRoute {
  return {
    meta,
    path
  }
}

describe(getRedirectNavigationTarget, () => {
  it('should mark api redirects as external document navigations', () => {
    const result = getRedirectNavigationTarget('/api/equipment/brands')

    expect(result).toStrictEqual({
      external: true,
      path: '/api/equipment/brands'
    })
  })

  it('should keep app routes as internal navigations', () => {
    const result = getRedirectNavigationTarget('/account')

    expect(result).toStrictEqual({
      external: false,
      path: '/account'
    })
  })

  it.each([
    ['', '/'],
    ['   ', '/'],
    ['https://evil.example/path', '/'],
    ['//evil.example/path', '/'],
    [undefined, '/']
  ])('should fall back to the start page for invalid redirect target %j', (redirectTo, expectedPath) => {
    const result = getRedirectNavigationTarget(redirectTo)

    expect(result).toStrictEqual({
      external: false,
      path: expectedPath
    })
  })
})

describe(shouldSkipAuth, () => {
  it('should skip routes marked with auth metadata', () => {
    const route = createRoute('/auth/twitch', {
      skipAuth: true
    })

    const result = shouldSkipAuth(route)

    expect(result).toBe(true)
  })

  it('should skip api document navigations', () => {
    const route = createRoute('/api/oauth/twitch')

    const result = shouldSkipAuth(route)

    expect(result).toBe(true)
  })

  it('should keep regular app routes protected', () => {
    const route = createRoute('/catalog')

    const result = shouldSkipAuth(route)

    expect(result).toBe(false)
  })
})
