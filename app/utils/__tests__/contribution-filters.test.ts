import { describe, expect, it } from 'vitest'
import { buildContributionQuery, parseContributionFilters } from '../contribution-filters'

describe('contribution filter URLs', () => {
  it('should omit defaults and normalize unknown values', () => {
    const defaults = parseContributionFilters({})

    expect(defaults).toStrictEqual({
      status: '',
      type: ''
    })

    const normalized = parseContributionFilters({
      status: 'published',
      type: 'unknown'
    })

    expect(normalized).toStrictEqual({
      status: '',
      type: ''
    })

    const query = buildContributionQuery({
      status: '',
      type: ''
    })

    expect(query).toStrictEqual({
      status: undefined,
      type: undefined
    })
  })

  it.each(['pending', 'approved', 'rejected'] as const)('should round-trip %s and read the first repeated value', (status) => {
    const filters = parseContributionFilters({
      status: [status, 'pending'],
      type: ['photos', 'gear']
    })

    expect(filters).toStrictEqual({
      status,
      type: 'photos'
    })

    const query = buildContributionQuery(filters)

    expect(query).toStrictEqual({
      status,
      type: 'photos'
    })

    const gearFilters = parseContributionFilters({
      status,
      type: 'gear'
    })

    expect(gearFilters).toStrictEqual({
      status,
      type: 'gear'
    })
  })
})
