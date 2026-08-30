<template>
  <PageContent page-title="Review photo submissions">
    <template #actions>
      <PerdLink :to="appRoutes.admin">
        Back to Admin
      </PerdLink>
    </template>

    <PageLoadingState v-if="isInitialLoading" title="Loading photo submissions" />

    <PagePlaceholder
      v-else-if="hasInitialError"
      emoji="📷"
      title="Photo submissions unavailable."
    >
      The review queue could not be loaded.

      <template #actions>
        <PerdButton variant="secondary" @click="retryInitialLoad">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <PagePlaceholder v-else-if="isEmpty" emoji="✨" title="The photo review queue is clear.">
      No pending photo submissions need attention right now.
    </PagePlaceholder>

    <div v-else :class="$style.component">
      <div :class="$style.list">
        <NuxtLink
          v-for="submission in submissionViews"
          :key="submission.id"
          :to="submission.path"
          :class="$style.card"
        >
          <span :class="$style.name">{{ submission.itemName }}</span>
          <span :class="$style.metadata">{{ submission.brandAndCategory }}</span>
          <span :class="$style.metadata">{{ submission.filename }}</span>
          <span :class="$style.metadata">Submitted by {{ submission.author }}</span>
          <time :datetime="submission.dateTime" :class="$style.metadata">
            {{ submission.formattedDate }}
          </time>
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
        All pending photo submissions are loaded.
      </p>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch } from '#imports'

  import type {
    PhotoSubmissionListCursor,
    PhotoSubmissionListItem
  } from '#server/api/equipment/photo-submissions/index.get'

  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes, createAdminEquipmentPhotoSubmissionPath } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const pageSize = 20
  const requestFetch = useRequestFetch()
  const paginationStatus = useTemplateRef('paginationStatus')
  const paginationCursor = ref<PhotoSubmissionListCursor | null>(null)
  const appendedItems = ref<PhotoSubmissionListItem[]>([])
  const isLoadingMore = ref(false)
  const hasLoadMoreError = ref(false)
  const isPaginationComplete = ref(false)

  const {
    data: initialResponse,
    error: initialError,
    refresh: refreshInitial,
    status: initialStatus
  } = await useFetch('/api/equipment/photo-submissions', {
    lazy: true,

    query: {
      limit: pageSize
    }
  })

  const allItems = computed(() => [
    ...(initialResponse.value?.items ?? []),
    ...appendedItems.value
  ])

  const isInitialLoading = computed(() => initialStatus.value === 'pending')
  const hasInitialError = computed(() => initialError.value !== undefined)
  const isEmpty = computed(() => allItems.value.length === 0)
  const hasMore = computed(() => paginationCursor.value !== null)

  watch(initialResponse, (response) => {
    if (response !== undefined) {
      paginationCursor.value = response.nextCursor
    }
  }, { immediate: true })

  const dateFormatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric'
  })

  const submissionViews = computed(() => allItems.value.map((submission) => {
    const date = new Date(submission.createdAt)
    let author = 'Deleted account'

    if (submission.author !== null) {
      author = submission.author.name ?? `User ${submission.author.id.slice(0, 8)}`
    }

    return {
      author,
      brandAndCategory: `${submission.item.brand.name} · ${submission.item.category.name}`,
      dateTime: date.toISOString(),
      filename: submission.filename,
      formattedDate: dateFormatter.format(date),
      id: submission.id,
      itemName: submission.item.name,
      path: createAdminEquipmentPhotoSubmissionPath(submission.id)
    }
  }))

  async function retryInitialLoad() {
    await refreshInitial()
  }

  async function loadMore() {
    const cursor = paginationCursor.value

    if (isLoadingMore.value || cursor === null) {
      return
    }

    isLoadingMore.value = true
    hasLoadMoreError.value = false

    try {
      const response = await requestFetch('/api/equipment/photo-submissions', {
        query: {
          afterCreatedAt: cursor.createdAt,
          afterId: cursor.id,
          limit: pageSize
        }
      })

      appendedItems.value.push(...response.items)
      paginationCursor.value = response.nextCursor

      if (response.nextCursor === null) {
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
  @import '../../../../assets/styles/admin-review-queue.css';
</style>
