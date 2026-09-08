import { describe, expect, it } from 'vitest'
import { startPagePath } from '#shared/constants'
import { sanitizeRedirectPath } from '../redirect'

describe('safe authentication redirects', () => {
  it.each(['https://example.com', '//example.com', String.raw`/\example.com`, '/\n/example.com', '/\t/example.com', '/gear\u007F', undefined])('should reject unsafe target %s', (value) => {
    expect(sanitizeRedirectPath(value)).toBe(startPagePath)
  })

  it.each(['/my-gear', '/packing-lists?q=tent#entry', '/api/equipment/brands'])('should preserve internal target %s', (value) => {
    expect(sanitizeRedirectPath(value)).toBe(value)
  })
})
