<template>
  <PageContent :page-title="pageTitle">
    <template #actions>
      <PerdLink :to="gearLibraryReturnPath" @click.capture="handleGearLibraryBackClick">
        Back to gear library
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isItemLoading"
        title="Loading item"
      />

      <PagePlaceholder v-else-if="hasItemError" emoji="🧭" title="Item unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <div :class="$style.topGrid">
          <div :class="$style.mainColumn">
            <GearLibraryItemMediaCard :category-name="itemResponse.category.name" />

            <GearLibraryItemSummaryCard
              :brand-name="itemResponse.brand.name"
              :category-name="itemResponse.category.name"
            />
          </div>

          <GearLibraryItemMyGearCard
            :action-icon="myGearActionIcon"
            :action-text="myGearActionText"
            :action-variant="myGearActionVariant"
            :description="myGearDescription"
            :error-message="myGearErrorMessage"
            :has-my-gear-error="hasMyGearError"
            :is-action-disabled="isMyGearActionDisabled"
            :is-action-loading="isMyGearActionLoading"
            :state-class="myGearStateClass"
            :state-icon="myGearStateIcon"
            :state-text="myGearStateText"
            @my-gear-action="handleMyGearAction"
          />
        </div>

        <GearLibraryItemSpecsCard :properties="displayProperties" />
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute, useRouter } from '#imports'
  import type { ItemProperty } from '~/types/equipment'
  import {
    getCanonicalGearLibraryReturnPath,
    sanitizeGearLibraryReturnPath
  } from '~/utils/gear-library-return-path'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import GearLibraryItemMediaCard from '~/components/gear-library/GearLibraryItemMediaCard.vue'
  import GearLibraryItemMyGearCard from '~/components/gear-library/GearLibraryItemMyGearCard.vue'
  import GearLibraryItemSpecsCard from '~/components/gear-library/GearLibraryItemSpecsCard.vue'
  import GearLibraryItemSummaryCard from '~/components/gear-library/GearLibraryItemSummaryCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const router = useRouter()
  const gearLibraryReturnPath = computed(() => sanitizeGearLibraryReturnPath(route.query.returnTo))
  const itemId = Array.isArray(route.params.id)
    ? route.params.id[0] ?? ''
    : route.params.id

  const myGearErrorMessage = ref<string | null>(null)
  const isMyGearPending = ref(false)
  const $fetch = useRequestFetch()

  function handleGearLibraryBackClick(event: MouseEvent) {
    const hasModifierKey = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    const isPrimaryUnmodifiedClick = event.button === 0 && hasModifierKey === false
    const historyState: unknown = globalThis.history.state
    const historyBackPath = typeof historyState === 'object'
      && historyState !== null
      && 'back' in historyState
      ? getCanonicalGearLibraryReturnPath(historyState.back)
      : null
    const hasMatchingHistoryEntry = historyBackPath !== null
      && historyBackPath === gearLibraryReturnPath.value

    if (isPrimaryUnmodifiedClick === false || hasMatchingHistoryEntry === false) {
      return
    }

    event.preventDefault()
    router.back()
  }

  const {
    data: itemResponse,
    error: itemError,
    refresh: refreshItem,
    status: itemStatus
  } = await useFetch(`/api/equipment/items/${itemId}`, {
    default: () => {
      return {
        brand: {
          id: 0,
          name: '',
          slug: ''
        },

        category: {
          id: 0,
          name: '',
          slug: ''
        },

        createdAt: '',
        id: '',
        name: '',
        properties: []
      }
    }
  })

  const {
    data: myGearResponse,
    error: myGearError,
    refresh: refreshMyGear,
    status: myGearStatus
  } = await useFetch('/api/user/gear', {
    default: () => []
  })

  const hasItemError = computed(() => itemError.value !== undefined)
  const isItemLoading = computed(() => itemStatus.value === 'pending')
  const isMyGearLoading = computed(() => myGearStatus.value === 'pending')
  const hasMyGearError = computed(() => myGearError.value !== undefined)

  function formatPropertyValue(property: ItemProperty): string {
    if (property.value === null) {
      return 'Not set'
    }

    if (typeof property.value === 'boolean') {
      return property.value ? 'Yes' : 'No'
    }

    const value = String(property.value)

    if (property.unit !== null && property.unit !== '') {
      return `${value} ${property.unit}`
    }

    return value
  }

  const pageTitle = computed(() => itemResponse.value.name === '' ? 'Gear item' : itemResponse.value.name)
  const ownedMyGearRow = computed(() => myGearResponse.value.find((myGearRow) => myGearRow.item.id === itemResponse.value.id))
  const isOwned = computed(() => ownedMyGearRow.value !== undefined)
  const isMyGearActionLoading = computed(() => isMyGearLoading.value || isMyGearPending.value)
  const isMyGearActionDisabled = computed(() => isMyGearActionLoading.value || hasMyGearError.value || itemResponse.value.id === '')
  const myGearActionText = computed(() => {
    if (isMyGearLoading.value) {
      return 'Loading my gear'
    }

    return isOwned.value ? 'Remove from my gear' : 'Save to my gear'
  })
  const myGearActionVariant = computed(() => isOwned.value ? 'danger' : 'primary')
  const myGearActionIcon = computed(() => isOwned.value ? 'hugeicons:delete-02' : 'hugeicons:backpack-03')
  const myGearStateText = computed(() => {
    if (isMyGearLoading.value) {
      return 'Checking my gear'
    }

    if (hasMyGearError.value) {
      return 'My gear unavailable'
    }

    return isOwned.value ? 'Saved to my gear' : 'Not in my gear'
  })
  const myGearStateIcon = computed(() => {
    if (isMyGearLoading.value) {
      return 'hugeicons:hourglass'
    }

    if (hasMyGearError.value) {
      return 'hugeicons:alert-circle'
    }

    return isOwned.value ? 'hugeicons:checkmark-circle-02' : 'hugeicons:circle'
  })
  const myGearStateClass = computed(() => {
    if (isMyGearLoading.value) {
      return 'pending'
    }

    if (hasMyGearError.value) {
      return 'error'
    }

    return isOwned.value ? 'owned' : 'missing'
  })
  const myGearDescription = computed(() => {
    if (hasMyGearError.value) {
      return 'My gear unavailable.'
    }

    return ''
  })
  const displayProperties = computed(() => itemResponse.value.properties.map((property) => {
    return {
      dataType: property.dataType,
      displayValue: formatPropertyValue(property),
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      value: property.value
    }
  }))

  async function handleRetry() {
    await Promise.all([
      refreshItem(),
      refreshMyGear()
    ])
  }

  async function handleMyGearAction() {
    if (isMyGearActionDisabled.value) {
      return
    }

    myGearErrorMessage.value = null
    isMyGearPending.value = true
    const ownedBeforeRequest = isOwned.value
    const myGearRowId = ownedMyGearRow.value?.id

    try {
      if (ownedBeforeRequest === false) {
        const createdMyGearRow = await $fetch('/api/user/gear', {
          method: 'POST',

          body: {
            itemId: itemResponse.value.id
          }
        })

        myGearResponse.value = [
          createdMyGearRow,
          ...myGearResponse.value.filter((myGearRow) => myGearRow.item.id !== createdMyGearRow.item.id)
        ]
      } else if (myGearRowId !== undefined) {
        await $fetch(`/api/user/gear/${myGearRowId}`, {
          method: 'DELETE'
        })

        myGearResponse.value = myGearResponse.value.filter((myGearRow) => myGearRow.id !== myGearRowId)
      }
    } catch {
      myGearErrorMessage.value = ownedBeforeRequest === false
        ? 'Could not save item.'
        : 'Could not remove item.'
    } finally {
      isMyGearPending.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
  }

  .content {
    display: grid;
    gap: var(--spacing-24);
  }

  .topGrid {
    display: grid;
    gap: var(--spacing-24);

    @container (inline-size >= 60rem) {
      grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 0.95fr);
      align-items: start;
    }
  }

  .mainColumn {
    display: grid;
    gap: var(--spacing-24);
  }

</style>
