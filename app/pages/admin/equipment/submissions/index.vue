<template>
  <PageContent page-title="Review gear submissions">
    <template #actions>
      <PerdLink :to="appRoutes.admin">
        Back to Admin
      </PerdLink>
    </template>

    <PageLoadingState v-if="isInitialLoading" title="Loading gear submissions" />

    <PagePlaceholder
      v-else-if="hasInitialError"
      emoji="🧰"
      title="Gear submissions unavailable."
    >
      The review queue could not be loaded.

      <template #actions>
        <PerdButton variant="secondary" @click="retryInitialLoad">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <PagePlaceholder v-else-if="isEmpty" emoji="✨" title="The review queue is clear.">
      No pending gear submissions need attention right now.
    </PagePlaceholder>

    <div v-else :class="$style.component">
      <div :class="$style.list">
        <NuxtLink
          v-for="item in itemViews"
          :key="item.id"
          :to="item.path"
          :class="$style.card"
        >
          <span :class="$style.name">{{ item.name }}</span>
          <span :class="$style.metadata">{{ item.brandAndCategory }}</span>
          <span :class="$style.metadata">Submitted by {{ item.author }}</span>
          <time :datetime="item.dateTime" :class="$style.metadata">{{ item.formattedDate }}</time>
        </NuxtLink>
      </div>

      <p v-if="hasLoadMoreError" :class="$style.errorMessage" role="alert">
        Could not load more submissions. Try again.
      </p>

      <PerdButton
        v-if="hasMore"
        variant="secondary"
        :loading="isLoadingMore"
        @click="loadMore"
      >
        Load more
      </PerdButton>

      <p
        v-if="isPaginationComplete"
        ref="paginationStatus"
        :class="$style.paginationStatus"
        role="status"
        tabindex="-1"
      >
        All pending submissions are loaded.
      </p>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch } from '#imports'
  import type { ItemSubmissionListItem } from '#server/api/equipment/item-submissions/index.get'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes, createAdminEquipmentSubmissionPath } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const pageSize = 20
  const requestFetch = useRequestFetch()
  const paginationStatus = useTemplateRef('paginationStatus')
  const currentPage = ref(1)
  const appendedItems = ref<ItemSubmissionListItem[]>([])
  const isLoadingMore = ref(false)
  const hasLoadMoreError = ref(false)
  const isPaginationComplete = ref(false)

  const {
    data: initialResponse,
    error: initialError,
    refresh: refreshInitial,
    status: initialStatus
  } = await useFetch('/api/equipment/item-submissions', {
    query: {
      limit: pageSize,
      page: 1
    }
  })

  const allItems = computed(() => [
    ...(initialResponse.value?.items ?? []),
    ...appendedItems.value
  ])

  const isInitialLoading = computed(() => initialStatus.value === 'pending')
  const hasInitialError = computed(() => initialError.value !== undefined)
  const isEmpty = computed(() => allItems.value.length === 0)
  const total = computed(() => initialResponse.value?.total ?? 0)
  const hasMore = computed(() => allItems.value.length < total.value)

  const dateFormatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric'
  })

  const itemViews = computed(() => allItems.value.map((item) => {
    const date = new Date(item.createdAt)
    let author = 'Deleted account'

    if (item.author !== null) {
      author = item.author.name ?? `User ${item.author.id.slice(0, 8)}`
    }

    return {
      author,
      brandAndCategory: `${item.brand.name} · ${item.category.name}`,
      dateTime: date.toISOString(),
      formattedDate: dateFormatter.format(date),
      id: item.id,
      name: item.name,
      path: createAdminEquipmentSubmissionPath(item.id)
    }
  }))

  async function retryInitialLoad() {
    await refreshInitial()
  }

  async function loadMore() {
    if (isLoadingMore.value || hasMore.value === false) {
      return
    }

    const nextPage = currentPage.value + 1

    isLoadingMore.value = true
    hasLoadMoreError.value = false

    try {
      const response = await requestFetch('/api/equipment/item-submissions', {
        query: {
          limit: pageSize,
          page: nextPage
        }
      })

      appendedItems.value.push(...response.items)
      currentPage.value = nextPage

      const hasLoadedEveryItem = allItems.value.length >= total.value

      if (hasLoadedEveryItem) {
        isPaginationComplete.value = true

        await nextTick()

        paginationStatus.value?.focus()
      }
    } catch {
      hasLoadMoreError.value = true
    } finally {
      isLoadingMore.value = false
    }
  }
</script>

<style module>
  .component,
  .list {
    display: grid;
    gap: var(--spacing-16);
  }

  .card {
    display: grid;
    gap: var(--spacing-4);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-primary);
    color: inherit;
    text-decoration: none;

    &:hover,
    &:focus-visible {
      border-color: var(--color-accent-primary);
    }
  }

  .name {
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-bold);
  }

  .metadata {
    color: var(--color-text-tertiary);
  }

  .errorMessage {
    color: var(--color-danger-primary);
  }

  .paginationStatus {
    color: var(--color-text-tertiary);
  }
</style>
