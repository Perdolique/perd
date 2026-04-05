import { describe, expect, test } from 'vitest'
import { getRedirectNavigationTarget } from '../router'

describe(getRedirectNavigationTarget, () => {
  test('should mark api redirects as external document navigations', () => {
    const result = getRedirectNavigationTarget('/api/equipment/brands')

    expect(result).toStrictEqual({
      external: true,
      path: '/api/equipment/brands'
    })
  })

  test('should keep app routes as internal navigations', () => {
    const result = getRedirectNavigationTarget('/account')

    expect(result).toStrictEqual({
      external: false,
      path: '/account'
    })
  })

  test.each([
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
