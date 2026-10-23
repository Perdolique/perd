<template>
  <PageContent page-title="My contributions">
    <template #actions>
      <PerdLink :to="appLocations.account">
        Back to account
      </PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts do not have catalog contributions.
    </PagePlaceholder>

    <div v-else :class="$style.component">
      <div ref="filtersPanel" :class="$style.filters" role="group" aria-label="Contribution filters">
        <PerdSelect label="Status" :model-value="filters.status" :options="statusOptions" @update:model-value="changeStatus" />
        <PerdSelect label="Type" :model-value="filters.type" :options="typeOptions" @update:model-value="changeType" />
        <PerdButton v-if="hasFilters" variant="secondary" @click="handleClearFilters">Clear filters</PerdButton>
      </div>

      <p :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

      <PageLoadingState v-if="isLoading" title="Loading My contributions" />

      <PagePlaceholder
        v-else-if="hasError"
        emoji="🧰"
        title="My contributions unavailable."
      >
        Could not load your submissions.

        <template #actions>
          <PerdButton variant="secondary" @click="retry">
            Retry
          </PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="hasNoMatchingContributions" emoji="🔎" title="No matching contributions.">
        Try another status or type.
        <template #actions>
          <PerdButton variant="secondary" @click="handleClearFilters">Clear filters</PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder
        v-else-if="hasNoContributions"
        emoji="📭"
        title="No contributions yet."
      >
        Submit missing gear or a photo and its review status will appear here.

        <template #actions>
          <PerdLink :to="appLocations.gearLibraryNew">
            Submit gear
          </PerdLink>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <section v-if="hasItemSubmissions" :class="$style.section">
          <PerdHeading :level="2">Item submissions</PerdHeading>

          <div :class="$style.list">
            <PerdCard
              v-for="item in itemSubmissionCards"
              :key="item.id"
              :class="$style.card"
            >
              <div :class="$style.header">
                <div :class="$style.titleGroup">
                  <h3 :class="$style.cardTitle">
                    <PerdLink v-if="item.detailLocation" :to="item.detailLocation">
                      {{ item.name }}
                    </PerdLink>

                    <template v-else>
                      {{ item.name }}
                    </template>
                  </h3>

                  <p :class="$style.references">
                    {{ item.brandName }} · {{ item.categoryName }}
                  </p>
                </div>

                <PerdPill :tone="item.statusTone">
                  {{ item.statusLabel }}
                </PerdPill>
              </div>

              <dl :class="$style.metadata">
                <div :class="$style.metadataGroup">
                  <dt>Submitted</dt>

                  <dd>
                    <NuxtTime
                      :datetime="item.createdAt"
                      locale="en"
                      date-style="medium"
                      time-style="short"
                    />
                  </dd>
                </div>

                <div :class="$style.metadataGroup">
                  <dt>Last updated</dt>

                  <dd>
                    <NuxtTime
                      :datetime="item.updatedAt"
                      locale="en"
                      date-style="medium"
                      time-style="short"
                    />
                  </dd>
                </div>
              </dl>

              <div v-if="item.hasProperties" :class="$style.properties">
                <h4 :class="$style.sectionTitle">Known characteristics</h4>

                <dl :class="$style.propertyList">
                  <div
                    v-for="property in item.properties"
                    :key="property.propertyId"
                    :class="$style.property"
                  >
                    <dt>{{ property.name }}</dt>
                    <dd>{{ property.displayValue }}</dd>
                  </div>
                </dl>
              </div>

              <div v-if="item.hasRejectionReason" :class="$style.rejection">
                <strong>Rejection reason</strong>
                <p>{{ item.rejectionReason }}</p>
              </div>
            </PerdCard>
          </div>

        </section>

        <section v-if="hasPhotoSubmissions" :class="$style.section">
          <PerdHeading :level="2">Photo submissions</PerdHeading>

          <div :class="$style.list">
            <PerdCard
              v-for="photo in photoSubmissionCards"
              :key="photo.id"
              :class="$style.card"
            >
              <div :class="$style.header">
                <div :class="$style.titleGroup">
                  <h3 :class="$style.cardTitle">
                    <PerdLink :to="photo.itemLocation">
                      {{ photo.itemName }}
                    </PerdLink>
                  </h3>

                  <p>{{ photo.filename }}</p>
                  <p :class="$style.references">{{ photo.sourceLabel }}</p>

                  <a
                    v-if="photo.hasSourceUrl"
                    :href="photo.sourceUrl"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Manufacturer source
                  </a>
                </div>

                <PerdPill :tone="photo.statusTone">
                  {{ photo.statusLabel }}
                </PerdPill>
              </div>

              <dl :class="$style.metadata">
                <div :class="$style.metadataGroup">
                  <dt>Submitted</dt>

                  <dd>
                    <NuxtTime
                      :datetime="photo.createdAt"
                      locale="en"
                      date-style="medium"
                      time-style="short"
                    />
                  </dd>
                </div>

                <div :class="$style.metadataGroup">
                  <dt>Last updated</dt>

                  <dd>
                    <NuxtTime
                      :datetime="photo.updatedAt"
                      locale="en"
                      date-style="medium"
                      time-style="short"
                    />
                  </dd>
                </div>
              </dl>

              <div v-if="photo.hasRejectionReason" :class="$style.rejection">
                <strong>Rejection reason</strong>
                <p>{{ photo.rejectionReason }}</p>
              </div>
            </PerdCard>
          </div>

          <p v-if="hasPhotoLoadMoreError" :class="$style.errorMessage" role="alert">
            Could not load more photo submissions. Try again.
          </p>

          <PerdButton
            v-if="hasMorePhotoSubmissions"
            variant="secondary"
            :loading="isLoadingMorePhotos"
            @click="loadMorePhotoSubmissions"
          >
            Load more photo submissions
          </PerdButton>

          <p
            v-if="isPhotoPaginationComplete"
            ref="photoPaginationStatus"
            :class="$style.paginationStatus"
            role="status"
            tabindex="-1"
          >
            All photo submissions are loaded.
          </p>
        </section>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { onBeforeRouteLeave, type RouteLocationRaw } from 'vue-router'
  import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useUserStore } from '#imports'
  import { NuxtTime } from '#components'
  import type { UserItemSubmission, UserItemSubmissionProperty } from '#server/api/user/item-submissions/index.get'
  import type { UserPhotoSubmission } from '#server/api/user/photo-submissions/index.get'
  import { useContributionFeedback } from '~/composables/use-contribution-feedback'
  import { useContributionFilters } from '~/composables/use-contribution-filters'
  import PerdSelect from '~/components/perd-select/PerdSelect.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdPill, { type PerdPillTone } from '~/components/PerdPill.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appLocations, createGearLibraryItemLocation } from '~/utils/navigation'

  interface SubmissionPropertyCard {
    displayValue: string;
    name: string;
    propertyId: number;
  }

  interface SubmissionCard {
    brandName: string;
    categoryName: string;
    createdAt: Date | string;
    detailLocation: RouteLocationRaw | null;
    hasProperties: boolean;
    hasRejectionReason: boolean;
    id: string;
    name: string;
    properties: SubmissionPropertyCard[];
    rejectionReason: string | null;
    statusLabel: string;
    statusTone: PerdPillTone;
    updatedAt: Date | string;
  }

  interface PhotoSubmissionCard {
    createdAt: Date | string;
    filename: string;
    hasRejectionReason: boolean;
    hasSourceUrl: boolean;
    id: string;
    itemName: string;
    itemLocation: RouteLocationRaw;
    rejectionReason: string | null;
    sourceLabel: string;
    sourceUrl: string;
    statusLabel: string;
    statusTone: PerdPillTone;
    updatedAt: Date | string;
  }

  definePageMeta({ layout: 'page' })

  const { user } = useUserStore()
  const isGuest = computed(() => user.value.isGuest)
  const { filters, hasFilters, includesGear, includesPhotos, statusQuery, filterSignature, statusOptions, typeOptions, changeStatus, changeType, clearFilters } = useContributionFilters()
  let photoController: globalThis.AbortController | null = null
  const requestFetch = useRequestFetch()
  const filtersPanel = useTemplateRef('filtersPanel')
  const photoPaginationStatus = useTemplateRef('photoPaginationStatus')
  const appendedPhotoSubmissions = ref<UserPhotoSubmission[]>([])
  const nextPhotoPage = ref<number | null>(null)
  const isLoadingMorePhotos = ref(false)
  const hasPhotoLoadMoreError = ref(false)
  const isPhotoPaginationComplete = ref(false)

  const {
    data: itemSubmissions,
    error: itemSubmissionsError,
    refresh: refreshItemSubmissions,
    clear: clearItemSubmissions,
    status: itemSubmissionsStatus
  } = useFetch('/api/user/item-submissions', {
    key: 'my-contributions-gear',
    watch: false,
    query: { status: statusQuery },

    default: () => {
      return { items: [] }
    },

    immediate: isGuest.value === false && includesGear.value,
    lazy: true
  })

  const {
    data: photoSubmissions,
    error: photoSubmissionsError,
    refresh: refreshPhotoSubmissions,
    clear: clearPhotoSubmissions,
    status: photoSubmissionsStatus
  } = useFetch('/api/user/photo-submissions', {
    key: 'my-contributions-photos',
    watch: false,

    default: () => {
      return {
        items: [],
        nextPage: null
      }
    },

    immediate: isGuest.value === false && includesPhotos.value,
    lazy: true,

    query: {
      page: '1',
      status: statusQuery
    }
  })

  watch(
    () => photoSubmissions.value,
    (response) => {
      appendedPhotoSubmissions.value = []
      nextPhotoPage.value = response.nextPage
      hasPhotoLoadMoreError.value = false
      isPhotoPaginationComplete.value = false
    },
    { immediate: true }
  )

  const isLoading = computed(
    () => (includesGear.value && itemSubmissionsStatus.value === 'pending')
      || (includesPhotos.value && photoSubmissionsStatus.value === 'pending')
  )

  const hasError = computed(
    () => (includesGear.value && itemSubmissionsError.value !== undefined)
      || (includesPhotos.value && photoSubmissionsError.value !== undefined)
  )

  const hasItemSubmissions = computed(() => includesGear.value && itemSubmissions.value.items.length > 0)

  const allPhotoSubmissions = computed(() => {
    const submissionsById = new Map<string, UserPhotoSubmission>()

    for (const submission of [
      ...photoSubmissions.value.items,
      ...appendedPhotoSubmissions.value
    ]) {
      submissionsById.set(submission.id, submission)
    }

    return [...submissionsById.values()]
  })

  const hasPhotoSubmissions = computed(() => includesPhotos.value && allPhotoSubmissions.value.length > 0)
  const hasMorePhotoSubmissions = computed(() => nextPhotoPage.value !== null)

  const hasNoContributions = computed(
    () => hasItemSubmissions.value === false && hasPhotoSubmissions.value === false
  )

  const hasNoMatchingContributions = computed(() => hasNoContributions.value && hasFilters.value)

  const { announcement, handleClearFilters } = useContributionFeedback({
    filtersPanel,
    hasError,
    hasFilters,
    hasNoContributions,
    isLoading,
    resetFilters: clearFilters
  })

  function formatBoolean(value: boolean) {
    return value ? 'Yes' : 'No'
  }

  function formatProperty(property: UserItemSubmissionProperty): SubmissionPropertyCard {
    const {
      name,
      propertyId,
      unit,
      value: rawValue
    } = property

    const value = typeof rawValue === 'boolean' ? formatBoolean(rawValue) : rawValue
    const displayValue = unit === null ? value : `${value} ${unit}`

    return {
      displayValue,
      name,
      propertyId
    }
  }

  function getStatusPresentation(statusValue: UserItemSubmission['status']) {
    if (statusValue === 'approved') {
      return {
        label: 'Published',
        tone: 'success' as const
      }
    }

    if (statusValue === 'rejected') {
      return {
        label: 'Rejected',
        tone: 'danger' as const
      }
    }

    return {
      label: 'Pending',
      tone: 'warning' as const
    }
  }

  const itemSubmissionCards = computed<SubmissionCard[]>(() => itemSubmissions.value.items.map((item) => {
    const detailLocation = item.status === 'approved' ? createGearLibraryItemLocation(item.id) : null
    const statusPresentation = getStatusPresentation(item.status)
    const properties = item.properties.map(formatProperty)

    return {
      brandName: item.brand.name,
      categoryName: item.category.name,
      createdAt: item.createdAt,
      detailLocation,
      hasProperties: properties.length > 0,
      hasRejectionReason: item.rejectionReason !== null,
      id: item.id,
      name: item.name,
      properties,
      rejectionReason: item.rejectionReason,
      statusLabel: statusPresentation.label,
      statusTone: statusPresentation.tone,
      updatedAt: item.updatedAt
    }
  }))

  function getPhotoSourceLabel(sourceType: UserPhotoSubmission['sourceType']) {
    return sourceType === 'own' ? 'Own photo' : 'Official manufacturer photo'
  }

  const photoSubmissionCards = computed<PhotoSubmissionCard[]>(
    () => allPhotoSubmissions.value.map((photo) => {
      const statusPresentation = getStatusPresentation(photo.status)

      return {
        createdAt: photo.createdAt,
        filename: photo.filename,
        hasRejectionReason: photo.rejectionReason !== null,
        hasSourceUrl: photo.sourceUrl !== null,
        id: photo.id,
        itemName: photo.item.name,
        itemLocation: createGearLibraryItemLocation(photo.item.id),
        rejectionReason: photo.rejectionReason,
        sourceLabel: getPhotoSourceLabel(photo.sourceType),
        sourceUrl: photo.sourceUrl ?? '',
        statusLabel: statusPresentation.label,
        statusTone: statusPresentation.tone,
        updatedAt: photo.updatedAt
      }
    })
  )

  async function loadMorePhotoSubmissions() {
    if (isLoadingMorePhotos.value || nextPhotoPage.value === null) {
      return
    }

    const page = nextPhotoPage.value
    const signature = filterSignature.value
    const controller = new globalThis.AbortController()

    photoController = controller

    isLoadingMorePhotos.value = true
    hasPhotoLoadMoreError.value = false

    try {
      const queryPage = String(page)

      const response = await requestFetch('/api/user/photo-submissions', {
        query: {
          page: queryPage,
          status: statusQuery.value
        },

        signal: controller.signal,
        retry: 0
      })

      if (controller.signal.aborted || signature !== filterSignature.value) {
        return
      }

      appendedPhotoSubmissions.value.push(...response.items)

      nextPhotoPage.value = response.nextPage

      if (response.nextPage === null) {
        isPhotoPaginationComplete.value = true

        await nextTick()
        photoPaginationStatus.value?.focus()
      }
    } catch {
      if (controller.signal.aborted === false && signature === filterSignature.value) {
        hasPhotoLoadMoreError.value = true
      }
    } finally {
      if (photoController === controller) {
        photoController = null
        isLoadingMorePhotos.value = false
      }
    }
  }

  async function retry() {
    if (isGuest.value) {
      return
    }

    const gearRequest = includesGear.value ? refreshItemSubmissions({ dedupe: 'cancel' }) : undefined
    const photosRequest = includesPhotos.value ? refreshPhotoSubmissions({ dedupe: 'cancel' }) : undefined

    await Promise.all([gearRequest, photosRequest])
  }

  function cancelRequests() {
    photoController?.abort()

    photoController = null
    isLoadingMorePhotos.value = false

    clearItemSubmissions()
    clearPhotoSubmissions()
  }

  watch(filterSignature, () => {
    cancelRequests()

    appendedPhotoSubmissions.value = []
    nextPhotoPage.value = null
    hasPhotoLoadMoreError.value = false
    isPhotoPaginationComplete.value = false
    void retry()
  }, { flush: 'sync' })

  onBeforeRouteLeave(cancelRequests)
  onBeforeUnmount(cancelRequests)
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .announcement {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    align-items: end;
    gap: var(--spacing-16);
  }

  .content,
  .section,
  .list,
  .card,
  .properties,
  .rejection {
    display: grid;
    gap: var(--spacing-16);
  }

  .errorMessage {
    color: var(--color-danger-primary);
  }

  .paginationStatus {
    color: var(--color-text-tertiary);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--spacing-12);
    align-items: start;
  }

  .cardTitle {
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
  }

  .titleGroup,
  .metadataGroup,
  .property {
    display: grid;
    gap: var(--spacing-4);
  }

  .references,
  .metadata,
  .propertyList {
    color: var(--color-text-tertiary);
  }

  .metadata,
  .propertyList {
    display: grid;
    gap: var(--spacing-12);
  }

  .metadata {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .metadataGroup dt,
  .property dt,
  .sectionTitle {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .propertyList {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }

  .property,
  .rejection {
    padding: var(--spacing-12);
    border-radius: var(--border-radius-12);
    background: var(--color-surface-secondary);
  }

  .rejection {
    color: var(--color-danger-primary);
    border: 1px solid var(--color-danger-subtle);
  }
</style>
