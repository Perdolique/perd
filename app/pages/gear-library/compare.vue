<template>
  <PageContent page-title="Compare gear">
    <template #actions>
      <PerdLink :to="backToCatalogLocation">
        Edit compared items
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PagePlaceholder
        v-if="hasLocalValidationErrors"
        emoji="🧭"
        full-width
        title="This comparison cannot be opened."
      >
        <ul :class="$style.errorList">
          <li v-for="message in validationMessages" :key="message">
            {{ message }}
          </li>
        </ul>
      </PagePlaceholder>

      <PageLoadingState
        v-else-if="isComparisonPending"
        title="Loading comparison"
      />

      <PagePlaceholder
        v-else-if="hasComparisonError"
        emoji="🧭"
        full-width
        title="Comparison unavailable."
      >
        {{ comparisonErrorMessage }}

        <template v-if="canRetryComparison" #actions>
          <PerdButton variant="secondary" @click="refreshComparison">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <template v-else-if="comparisonResponse">
        <header :class="$style.summary">
          <div>
            <PerdHeading :level="2">
              {{ comparisonResponse.category.name }}
            </PerdHeading>

            <p :class="$style.count">
              {{ comparisonCountText }}
            </p>
          </div>

          <label :class="$style.differencesControl">
            <input
              v-model="showDifferencesOnly"
              :class="$style.differencesCheckbox"
              type="checkbox"
            >
            <span>Show differences only</span>
          </label>
        </header>

        <section :class="$style.comparison" aria-label="Gear comparison">
          <GearLibraryComparisonTable
            ref="comparisonTable"
            :caption="comparisonCaption"
            :items="tableItems"
            :rows="comparisonRows"
            @remove="handleRemoveComparisonItem"
          />

          <p v-if="showEmptyState" :class="$style.emptyState" role="status">
            {{ emptyStateMessage }}
          </p>
        </section>
      </template>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import { definePageMeta, navigateTo, useAsyncData, useRequestFetch, useRoute } from '#imports'
  import type { ComparisonResponse } from '#server/api/equipment/comparisons.get'
  import { createGearLibraryComparisonRows, validateGearLibraryComparisonQuery } from '~/utils/gear-library-comparison'
  import { appRoutes, createGearLibraryItemPath } from '~/utils/navigation'

  import GearLibraryComparisonTable, {
    type GearLibraryComparisonTableItem
  } from '~/components/gear-library/GearLibraryComparisonTable.vue'

  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  interface ErrorWithStatus {
    status?: number;
    statusCode?: number;
  }

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const requestFetch = useRequestFetch()
  const comparisonPath = '/api/equipment/comparisons' as const
  const showDifferencesOnly = ref(false)
  const pendingLocalComparisonSignature = ref<string>()
  const pendingRemovalFocusItemId = ref<string>()
  const comparisonTable = useTemplateRef('comparisonTable')

  const comparisonValidation = computed(
    () => validateGearLibraryComparisonQuery(route.query.item)
  )

  const orderedItemIds = computed(() => comparisonValidation.value.ids)

  const comparisonRequest = await useAsyncData('gear-library-comparison', async (_nuxtApp, { signal }) => {
    const validation = comparisonValidation.value

    if (validation.isValid === false) {
      return null
    }

    const query = {
      itemId: validation.ids
    }

    const comparisonPromise = requestFetch(comparisonPath, {
      query,
      signal
    })

    return comparisonPromise
  },
  {
    default: () => null
  })

  const {
    clear: clearComparison,
    data: comparisonResponse,
    error: comparisonError,
    refresh: refreshComparisonRequest,
    status: comparisonStatus
  } = comparisonRequest

  const validationMessages = computed(() => {
    const validation = comparisonValidation.value
    const messages: string[] = []

    if (validation.hasInsufficientIds) {
      messages.push('Select 2 to 4 items to compare.')
    }

    if (validation.hasOverLimitIds) {
      messages.push('This comparison contains more than 4 items.')
    }

    if (validation.hasInvalidIds) {
      messages.push('This comparison link contains an invalid item ID.')
    }

    if (validation.hasDuplicateIds) {
      messages.push('This comparison contains the same item more than once.')
    }

    return messages
  })

  const hasLocalValidationErrors = computed(() => validationMessages.value.length > 0)

  const isComparisonPending = computed(
    () => comparisonStatus.value === 'idle' || comparisonStatus.value === 'pending'
  )

  const hasComparisonError = computed(
    () => comparisonError.value !== undefined && comparisonError.value !== null
  )

  function getErrorStatus(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return
    }

    const errorWithStatus = error as ErrorWithStatus

    return errorWithStatus.statusCode ?? errorWithStatus.status
  }

  const comparisonErrorStatus = computed(() => getErrorStatus(comparisonError.value))

  const comparisonErrorMessage = computed(() => {
    if (comparisonErrorStatus.value === 400) {
      return 'These items cannot be compared because they are not all from the same category.'
    }

    if (comparisonErrorStatus.value === 404) {
      return 'One or more comparison items are unavailable.'
    }

    return 'Could not load this comparison.'
  })

  const canRetryComparison = computed(() => {
    const status = comparisonErrorStatus.value

    return status !== 400 && status !== 404
  })

  const comparisonCountText = computed(() => {
    const itemCount = comparisonResponse.value?.items.length ?? 0

    return `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
  })

  const comparisonCaption = computed(() => {
    const categoryName = comparisonResponse.value?.category.name ?? ''

    return `${categoryName}, ${comparisonCountText.value}`
  })

  function createTableItem(
    item: ComparisonResponse['items'][number]
  ): GearLibraryComparisonTableItem {
    const itemId = item.id

    return {
      brand: {
        name: item.brand.name
      },
      cloudflareImageId: item.cloudflareImageId,
      detailPath: createGearLibraryItemPath(itemId),
      id: itemId,
      name: item.name
    }
  }

  const tableItems = computed(
    () => comparisonResponse.value?.items.map(createTableItem) ?? []
  )

  const comparisonRows = computed(() => {
    const response = comparisonResponse.value

    if (response === null) {
      return []
    }

    const visibleItemIds = response.items.map((item) => item.id)

    return createGearLibraryComparisonRows(
      response.properties,
      visibleItemIds,
      showDifferencesOnly.value
    )
  })

  const hasNoComparisonProperties = computed(
    () => comparisonResponse.value?.properties.length === 0
  )

  const showEmptyState = computed(
    () => hasNoComparisonProperties.value || comparisonRows.value.length === 0
  )

  const emptyStateMessage = computed(() => {
    if (hasNoComparisonProperties.value) {
      return 'No comparison properties available.'
    }

    return 'No differences between these items.'
  })

  const backToCatalogLocation = computed(() => {
    const response = comparisonResponse.value

    if (response === null) {
      return appRoutes.gearLibrary
    }

    return {
      path: appRoutes.gearLibrary,
      query: {
        category: response.category.slug,
        compare: orderedItemIds.value
      }
    }
  })

  async function refreshComparison() {
    await refreshComparisonRequest()
  }

  function removeItemFromComparisonResponse(
    response: ComparisonResponse,
    itemId: string
  ): ComparisonResponse {
    const items = response.items.filter((item) => item.id !== itemId)

    const properties = response.properties.map((property) => {
      const values = property.values.filter((value) => value.itemId !== itemId)

      return {
        dataType: property.dataType,
        id: property.id,
        name: property.name,
        slug: property.slug,
        unit: property.unit,
        values
      }
    })

    return {
      category: {
        id: response.category.id,
        name: response.category.name,
        slug: response.category.slug
      },
      items,
      properties
    }
  }

  async function handleRemoveComparisonItem(
    itemId: string,
    focusTargetId?: string
  ) {
    const remainingItemIds = orderedItemIds.value.filter(
      (selectedItemId) => selectedItemId !== itemId
    )

    const response = comparisonResponse.value

    if (response === null) {
      return
    }

    if (remainingItemIds.length < 2) {
      const catalogLocation = {
        path: appRoutes.gearLibrary,
        query: {
          category: response.category.slug,
          compare: remainingItemIds
        }
      }

      await navigateTo(catalogLocation, { replace: true })

      return
    }

    const updatedResponse = removeItemFromComparisonResponse(response, itemId)
    const remainingItemSignature = remainingItemIds.join(',')

    comparisonResponse.value = updatedResponse
    pendingLocalComparisonSignature.value = remainingItemSignature
    pendingRemovalFocusItemId.value = focusTargetId

    const comparisonLocation = {
      path: route.path,
      query: {
        item: remainingItemIds
      }
    }

    await navigateTo(comparisonLocation, { replace: true })

    const currentItemSignature = comparisonValidation.value.ids.join(',')

    if (currentItemSignature !== remainingItemSignature) {
      comparisonResponse.value = response
      pendingLocalComparisonSignature.value = undefined
      pendingRemovalFocusItemId.value = undefined
    }
  }

  watch(() => route.fullPath, async () => {
    if (comparisonValidation.value.isValid === false) {
      pendingRemovalFocusItemId.value = undefined
      pendingLocalComparisonSignature.value = undefined

      clearComparison()

      return
    }

    const currentItemSignature = comparisonValidation.value.ids.join(',')

    const isLocallyHandledRemoval = currentItemSignature
      === pendingLocalComparisonSignature.value

    pendingLocalComparisonSignature.value = undefined

    if (isLocallyHandledRemoval === false) {
      await refreshComparisonRequest()
    }

    const focusTargetId = pendingRemovalFocusItemId.value

    if (focusTargetId === undefined) {
      return
    }

    pendingRemovalFocusItemId.value = undefined

    await nextTick()

    comparisonTable.value?.focusRemoveButton(focusTargetId)
  })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-16);
  }

  .count {
    color: var(--color-text-secondary);
  }

  .differencesControl {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-8);
    min-block-size: var(--layout-touch-target);
    color: var(--color-text-primary);
    cursor: pointer;
    font-weight: var(--font-weight-semibold);
  }

  .differencesCheckbox {
    inline-size: 1.15rem;
    block-size: 1.15rem;
    accent-color: var(--color-accent-primary);

    &:focus-visible {
      box-shadow: var(--shadow-focus);
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  .comparison {
    display: grid;
    gap: var(--spacing-16);
    min-inline-size: 0;
  }

  .emptyState {
    padding: var(--spacing-24);
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-primary);
    color: var(--color-text-secondary);
    text-align: center;
  }

  .errorList {
    display: grid;
    gap: var(--spacing-8);
    text-align: start;
  }
</style>
