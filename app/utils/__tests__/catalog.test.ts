import { describe, expect, it } from 'vitest'
import { buildCatalogRouteQuery, getCatalogItemsApiQuery, getCatalogRouteState } from '../catalog'

describe(getCatalogRouteState, () => {
  it('should normalize the public catalog page query', () => {
    const result = getCatalogRouteState({
      page: '2'
    })

    expect(result).toStrictEqual({
      page: 2
    })
  })

  it('should ignore unsupported query keys and invalid page values', () => {
    const result = getCatalogRouteState({
      category: 'sleeping-pads',
      page: 'wat'
    })

    expect(result).toStrictEqual({
      page: 1
    })
  })
})

describe(getCatalogItemsApiQuery, () => {
  it('should map only the public page key to the backend query contract', () => {
    const result = getCatalogItemsApiQuery({
      category: 'sleeping-pads',
      page: '3'
    })

    expect(result).toStrictEqual({
      page: 3
    })
  })

  it('should default to the first page when the query is empty', () => {
    const result = getCatalogItemsApiQuery({})

    expect(result).toStrictEqual({
      page: 1
    })
  })
})

describe(buildCatalogRouteQuery, () => {
  it('should keep only the public page query key', () => {
    const result = buildCatalogRouteQuery({
      page: 3
    })

    expect(result).toStrictEqual({
      page: '3'
    })
  })

  it('should omit page=1 from the public catalog url', () => {
    const result = buildCatalogRouteQuery({
      page: 1
    })

    expect(result).toStrictEqual({})
  })
})
