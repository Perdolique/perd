import { describe, expectTypeOf, it } from 'vitest'
import type { RequestBody, RequestQuery } from '#build/server-routes'

describe('generated API request types', () => {
  it('requires the brand fields clients send before validation', () => {
    expectTypeOf<RequestBody<'/api/equipment/brands', 'POST'>>().toEqualTypeOf<{
      name: string;
      slug: string;
    }>()
  })

  it('accepts an optional string search for the brand list', () => {
    expectTypeOf<RequestQuery<'/api/equipment/brands'>>().toEqualTypeOf<{
      search?: string;
    }>()
  })

  it('requires pagination as strings before query validation transforms them', () => {
    type ItemsQuery = RequestQuery<'/api/equipment/items'>

    expectTypeOf<Pick<ItemsQuery, 'limit' | 'page'>>().toEqualTypeOf<{
      limit?: string;
      page?: string;
    }>()
  })
})
