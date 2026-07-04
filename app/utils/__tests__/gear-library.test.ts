import { describe, expect, it } from 'vitest'
import { buildGearLibraryRouteQuery, getGearLibraryItemsApiQuery, getGearLibraryRouteState } from '../gear-library'

describe(getGearLibraryRouteState, () => {
  it('should normalize the public gear library page query', () => {
    const result = getGearLibraryRouteState({
      page: '2'
    })

    expect(result).toStrictEqual({
      page: 2
    })
  })

  it('should ignore unsupported query keys and invalid page values', () => {
    const result = getGearLibraryRouteState({
      category: 'sleeping-pads',
      page: 'wat'
    })

    expect(result).toStrictEqual({
      page: 1
    })
  })
})

describe(getGearLibraryItemsApiQuery, () => {
  it('should map only the public page key to the backend query contract', () => {
    const result = getGearLibraryItemsApiQuery({
      category: 'sleeping-pads',
      page: '3'
    })

    expect(result).toStrictEqual({
      page: 3
    })
  })

  it('should default to the first page when the query is empty', () => {
    const result = getGearLibraryItemsApiQuery({})

    expect(result).toStrictEqual({
      page: 1
    })
  })
})

describe(buildGearLibraryRouteQuery, () => {
  it('should keep only the public page query key', () => {
    const result = buildGearLibraryRouteQuery({
      page: 3
    })

    expect(result).toStrictEqual({
      page: '3'
    })
  })

  it('should omit page=1 from the public gear library url', () => {
    const result = buildGearLibraryRouteQuery({
      page: 1
    })

    expect(result).toStrictEqual({})
  })
})
