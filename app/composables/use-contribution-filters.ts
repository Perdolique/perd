import { computed, watch } from 'vue'
import { navigateTo, useRoute } from '#imports'

import {
  buildContributionQuery,
  parseContributionFilters,
  type ContributionFilters
} from '~/utils/contribution-filters'

import { appLocations } from '~/utils/navigation'

async function writeFilters(nextFilters: ContributionFilters) {
  const query = buildContributionQuery(nextFilters)

  await navigateTo({
    name: appLocations.accountSubmissions.name,
    query
  })
}

async function clearFilters() {
  await writeFilters({
    status: '',
    type: ''
  })
}

/** Owns contribution filter controls and their browser history. */
function useContributionFilters() {
  const route = useRoute()
  const filters = computed(() => parseContributionFilters(route.query))
  const hasFilters = computed(() => filters.value.status !== '' || filters.value.type !== '')
  const includesGear = computed(() => filters.value.type !== 'photos')
  const includesPhotos = computed(() => filters.value.type !== 'gear')
  const statusQuery = computed(() => filters.value.status || undefined)
  const filterSignature = computed(() => JSON.stringify(filters.value))

  const statusOptions = [
    {
      value: '',
      label: 'All statuses'
    },
    {
      value: 'pending',
      label: 'Pending'
    },
    {
      value: 'approved',
      label: 'Published'
    },
    {
      value: 'rejected',
      label: 'Rejected'
    }
  ]

  const typeOptions = [
    {
      value: '',
      label: 'All types'
    },
    {
      value: 'gear',
      label: 'Gear'
    },
    {
      value: 'photos',
      label: 'Photos'
    }
  ]

  async function changeStatus(value: string) {
    const nextFilters = parseContributionFilters({
      status: value,
      type: filters.value.type
    })

    await writeFilters(nextFilters)
  }

  async function changeType(value: string) {
    const nextFilters = parseContributionFilters({
      status: filters.value.status,
      type: value
    })

    await writeFilters(nextFilters)
  }

  watch(() => route.query, async (query) => {
    const nextFilters = parseContributionFilters(query)
    const canonical = buildContributionQuery(nextFilters)

    if (query.status !== canonical.status || query.type !== canonical.type) {
      await navigateTo({
        name: appLocations.accountSubmissions.name,
        query: canonical
      }, { replace: true })
    }
  }, { immediate: true })

  return {
    filters,
    hasFilters,
    includesGear,
    includesPhotos,
    statusQuery,
    filterSignature,
    statusOptions,
    typeOptions,
    changeStatus,
    changeType,
    clearFilters
  }
}

export { useContributionFilters }
