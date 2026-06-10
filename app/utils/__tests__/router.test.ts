import { describe, expect, it } from 'vitest'
import { getRedirectNavigationTarget } from '../router'

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
