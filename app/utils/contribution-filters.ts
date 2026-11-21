import type { LocationQuery, LocationQueryRaw } from 'vue-router'

interface ContributionFilters {
  status: '' | 'pending' | 'approved' | 'rejected';
  type: '' | 'gear' | 'photos';
}

function parseContributionFilters(query: LocationQuery): ContributionFilters {
  const status = Array.isArray(query.status) ? query.status[0] : query.status
  const type = Array.isArray(query.type) ? query.type[0] : query.type
  const normalizedStatus = status === 'pending' || status === 'approved' || status === 'rejected' ? status : ''
  const normalizedType = type === 'gear' || type === 'photos' ? type : ''

  return {
    status: normalizedStatus,
    type: normalizedType
  }
}

function buildContributionQuery(filters: ContributionFilters): LocationQueryRaw {
  return {
    status: filters.status || undefined,
    type: filters.type || undefined
  }
}

export { buildContributionQuery, parseContributionFilters }
export type { ContributionFilters }
