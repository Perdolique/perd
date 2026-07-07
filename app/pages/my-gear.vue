<template>
  <PageContent :page-title="navigationLabels.myGear">
    <template #actions>
      <PerdLink :to="appRoutes.gearLibrary">
        Find gear
      </PerdLink>
    </template>

    <div :class="$style.component">
      <PageLoadingState
        v-if="isInitialLoading"
        title="Loading my gear"
      />

      <PagePlaceholder v-else-if="hasError" emoji="🎒" title="My gear unavailable.">
        Try again.

        <template #actions>
          <PerdButton variant="secondary" @click="handleRetry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="isEmpty" emoji="🧺" title="No saved gear yet." />

      <div v-else :class="$style.list">
        <PageSummaryHeader :label="navigationLabels.myGear" :value="myGearSummaryText" />

        <p v-if="removeErrorMessage" :class="$style.errorMessage" role="status">
          {{ removeErrorMessage }}
        </p>

        <MyGearItemCard
          v-for="myGearRow in myGearItems"
          :key="myGearRow.id"
          :my-gear-row="myGearRow"
          @remove="handleRemove"
        />
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch } from '#imports'
  import { appRoutes, createGearLibraryItemPath, navigationLabels } from '~/utils/navigation'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageSummaryHeader from '~/components/PageSummaryHeader.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import MyGearItemCard from '~/components/my-gear/MyGearItemCard.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const removeErrorMessage = ref<string | null>(null)
  const removingMyGearId = ref<string | null>(null)
  const myGearDateFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium'
  })
  const requestFetch = useRequestFetch()

  const {
    data: myGearResponse,
    error: myGearError,
    refresh: refreshMyGear,
    status: myGearStatus
  } = await useFetch('/api/user/gear', {
    default: () => []
  })

  const hasError = computed(() => myGearError.value !== undefined)
  const isInitialLoading = computed(() => myGearStatus.value === 'pending')
  const isEmpty = computed(() => myGearResponse.value.length === 0)
  const myGearSummaryText = computed(() => {
    const itemCount = myGearResponse.value.length

    return `${itemCount} saved item${itemCount === 1 ? '' : 's'}`
  })

  function formatCreatedAt(createdAt: string) {
    return myGearDateFormatter.format(new Date(createdAt))
  }

  function isRemovingAnotherItem(myGearId: string) {
    return removingMyGearId.value !== null && removingMyGearId.value !== myGearId
  }

  async function handleRetry() {
    await refreshMyGear()
  }

  async function handleRemove(myGearId: string) {
    if (removingMyGearId.value !== null) {
      return
    }

    removeErrorMessage.value = null
    removingMyGearId.value = myGearId

    try {
      await requestFetch(`/api/user/gear/${myGearId}`, {
        method: 'DELETE'
      })

      myGearResponse.value = myGearResponse.value.filter((myGearRow) => myGearRow.id !== myGearId)
    } catch {
      removeErrorMessage.value = 'Could not remove item.'
    } finally {
      removingMyGearId.value = null
    }
  }

  const myGearItems = computed(() => myGearResponse.value.map((myGearRow) => {
    return {
      createdAt: myGearRow.createdAt,
      formattedCreatedAt: formatCreatedAt(myGearRow.createdAt),
      gearLibraryPath: createGearLibraryItemPath(myGearRow.item.id),
      id: myGearRow.id,
      isRemoveDisabled: isRemovingAnotherItem(myGearRow.id),
      isRemoving: removingMyGearId.value === myGearRow.id,
      item: myGearRow.item
    }
  }))
</script>

<style module>
  .component {
    display: grid;
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
  }

  .list {
    display: grid;
    gap: var(--spacing-24);
  }

</style>
