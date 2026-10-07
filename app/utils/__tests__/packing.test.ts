import { describe, expect, it } from 'vitest'
import { packingListCopyName } from '../packing'

describe('packing list copy name', () => {
  const maximumName = 'A'.repeat(128)
  const truncatedName = 'A'.repeat(121)
  const truncatedCopyName = `${truncatedName} — copy`
  const unicodePrefix = 'A'.repeat(120)
  const unicodeBoundaryName = `${unicodePrefix}🎒Long`
  const unicodeBoundaryCopyName = `${unicodePrefix} — copy`
  const maximumUnicodeName = '🎒'.repeat(64)
  const truncatedUnicodeName = '🎒'.repeat(60)
  const truncatedUnicodeCopyName = `${truncatedUnicodeName} — copy`

  it.each([
    ['Trip', 'Trip — copy'],
    [maximumName, truncatedCopyName],
    [unicodeBoundaryName, unicodeBoundaryCopyName],
    [maximumUnicodeName, truncatedUnicodeCopyName]
  ])('keeps the suffix within 128 UTF-16 units without splitting Unicode: %s', (name, expected) => {
    const result = packingListCopyName(name)

    expect(result).toBe(expected)
    expect(result.length).toBeLessThanOrEqual(128)
    expect(result.isWellFormed()).toBe(true)
  })
})
