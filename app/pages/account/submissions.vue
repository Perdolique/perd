<template>
  <PageContent page-title="My contributions">
    <template #actions>
      <PerdLink :to="appLocations.account">Back to account</PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts do not have catalog contributions.
    </PagePlaceholder>

    <div v-else :class="$style.component">
      <div ref="filtersPanel" :class="$style.filters" role="group" aria-label="Contribution filters">
        <fieldset :class="$style.typeFilter">
          <legend :class="$style.filterLabel">Type</legend>
          <div :class="$style.typeChoices">
            <label v-for="option in typeOptions" :key="option.value" :class="$style.choice">
              <input
                :class="$style.radio"
                type="radio"
                :name="typeFilterName"
                :value="option.value"
                :checked="option.selected"
                @change="changeType(option.value)"
              >
              <span :class="$style.choiceLabel">{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset :class="$style.statusFilter">
          <legend :class="$style.filterLabel">Status</legend>
          <div :class="$style.statusChoices">
            <label v-for="option in statusOptions" :key="option.value" :class="$style.choice">
              <input
                :class="$style.radio"
                type="radio"
                :name="statusFilterName"
                :value="option.value"
                :checked="option.selected"
                @change="changeStatus(option.value)"
              >
              <span :class="$style.choiceLabel">{{ option.label }}</span>
            </label>
          </div>
        </fieldset>

        <PerdButton
          :class="[$style.reset, { isActive: hasFilters }]"
          size="small"
          variant="ghost"
          @click="handleClearFilters"
        >
          Clear filters
        </PerdButton>
      </div>

      <p :class="$style.announcement" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>

      <PagePlaceholder v-if="hasNoMatchingContributions" emoji="🔎" title="No matching contributions.">
        Try another status or type.
        <template #actions>
          <PerdButton variant="secondary" @click="handleClearFilters">Clear filters</PerdButton>
        </template>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="hasNoContributions" emoji="📭" title="No contributions yet.">
        Submit missing gear or a photo and its review status will appear here.
        <template #actions>
          <PerdLink :to="appLocations.gearLibraryNew">Submit gear</PerdLink>
        </template>
      </PagePlaceholder>

      <div v-else :class="$style.content">
        <section
          v-if="includesGear"
          ref="gearSection"
          :class="$style.section"
          :aria-labelledby="gearHeadingId"
          :aria-busy="isLoadingGear"
          tabindex="-1"
        >
          <PerdHeading :id="gearHeadingId" :level="2">Gear contributions</PerdHeading>

          <p v-if="isLoadingGear" :class="$style.sectionMessage">
            <FidgetSpinner aria-hidden="true" />
            Loading gear contributions…
          </p>

          <div v-else-if="hasGearError" :class="$style.sectionError">
            <p>Could not load gear contributions.</p>
            <PerdButton size="small" variant="secondary" @click="retrySection('gear', $event)">Retry gear</PerdButton>
          </div>

          <p v-else-if="hasNoGearResults" :class="$style.sectionMessage">
            {{ gearEmptyMessage }}
          </p>

          <div v-else :class="$style.list">
            <article v-for="item in itemSubmissionCards" :key="item.id" :class="$style.card">
              <div :class="$style.header">
                <div :class="$style.titleGroup">
                  <h3 :class="$style.cardTitle">
                    <PerdLink v-if="item.detailLocation" :to="item.detailLocation">{{ item.name }}</PerdLink>
                    <template v-else>{{ item.name }}</template>
                  </h3>
                  <p :class="$style.references">{{ item.brandName }} · {{ item.categoryName }}</p>
                </div>
                <span :class="[$style.statusPill, item.statusTone]">{{ item.statusLabel }}</span>
              </div>

              <p :class="$style.submitted">
                Submitted <NuxtTime :datetime="item.createdAt" locale="en" date-style="medium" />
              </p>

              <div v-if="item.hasRejectionReason" :class="$style.rejection">
                <strong>Rejection reason</strong>
                <p>{{ item.rejectionReason }}</p>
              </div>

              <details>
                <summary :class="$style.detailsToggle">Submission details<span :class="$style.announcement"> for {{ item.name }}</span></summary>
                <div :class="$style.detailsBody">
                  <dl :class="$style.metadata">
                    <div :class="$style.metadataGroup">
                      <dt>Submitted</dt>
                      <dd><NuxtTime :datetime="item.createdAt" locale="en" date-style="medium" time-style="short" /></dd>
                    </div>
                    <div :class="$style.metadataGroup">
                      <dt>Last updated</dt>
                      <dd><NuxtTime :datetime="item.updatedAt" locale="en" date-style="medium" time-style="short" /></dd>
                    </div>
                  </dl>

                  <div v-if="item.hasProperties" :class="$style.properties">
                    <h4 :class="$style.sectionTitle">Known characteristics</h4>
                    <dl :class="$style.propertyList">
                      <div v-for="property in item.properties" :key="property.propertyId" :class="$style.property">
                        <dt>{{ property.name }}</dt>
                        <dd>{{ property.displayValue }}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </details>
            </article>
          </div>
        </section>

        <section
          v-if="includesPhotos"
          ref="photoSection"
          :class="$style.section"
          :aria-labelledby="photoHeadingId"
          :aria-busy="isLoadingPhotos"
          tabindex="-1"
        >
          <PerdHeading :id="photoHeadingId" :level="2">Photo contributions</PerdHeading>

          <p v-if="isLoadingPhotos" :class="$style.sectionMessage">
            <FidgetSpinner aria-hidden="true" />
            Loading photo contributions…
          </p>

          <div v-else-if="hasPhotosError" :class="$style.sectionError">
            <p>Could not load photo contributions.</p>
            <PerdButton size="small" variant="secondary" @click="retrySection('photos', $event)">Retry photos</PerdButton>
          </div>

          <p v-else-if="hasNoPhotoResults" :class="$style.sectionMessage">
            {{ photoEmptyMessage }}
          </p>

          <template v-else>
            <div :class="$style.list">
              <article v-for="photo in photoSubmissionCards" :key="photo.id" :class="$style.card">
                <div :class="$style.header">
                  <div :class="$style.titleGroup">
                    <h3 :class="$style.cardTitle"><PerdLink :to="photo.itemLocation">{{ photo.itemName }}</PerdLink></h3>
                    <p :class="$style.references">{{ photo.filename }}</p>
                  </div>
                  <span :class="[$style.statusPill, photo.statusTone]">{{ photo.statusLabel }}</span>
                </div>

                <p :class="$style.submitted">
                  {{ photo.sourceLabel }} · Submitted <NuxtTime :datetime="photo.createdAt" locale="en" date-style="medium" />
                </p>

                <div v-if="photo.hasRejectionReason" :class="$style.rejection">
                  <strong>Rejection reason</strong>
                  <p>{{ photo.rejectionReason }}</p>
                </div>

                <details>
                  <summary :class="$style.detailsToggle">Submission details<span :class="$style.announcement"> for {{ photo.filename }}</span></summary>
                  <div :class="$style.detailsBody">
                    <dl :class="$style.metadata">
                      <div :class="$style.metadataGroup">
                        <dt>Submitted</dt>
                        <dd><NuxtTime :datetime="photo.createdAt" locale="en" date-style="medium" time-style="short" /></dd>
                      </div>
                      <div :class="$style.metadataGroup">
                        <dt>Last updated</dt>
                        <dd><NuxtTime :datetime="photo.updatedAt" locale="en" date-style="medium" time-style="short" /></dd>
                      </div>
                    </dl>
                    <a v-if="photo.hasSourceUrl" :href="photo.sourceUrl" rel="noopener noreferrer" target="_blank">Manufacturer source</a>
                  </div>
                </details>
              </article>
            </div>

            <p v-if="hasPhotoLoadMoreError" role="alert">
              Could not load more photo submissions. Try again.
            </p>

            <PerdButton
              v-if="hasMorePhotoSubmissions"
              :class="$style.loadMore"
              variant="secondary"
              :loading="isLoadingMorePhotos"
              @click="loadMorePhotoSubmissions"
            >
              Load more photo submissions
            </PerdButton>

            <p v-if="isPhotoPaginationComplete" ref="photoPaginationStatus" :class="$style.paginationStatus" role="status" tabindex="-1">
              All photo submissions are loaded.
            </p>
          </template>
        </section>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useUserStore } from '#imports'
  import { NuxtTime } from '#components'
  import type { UserPhotoSubmission } from '#server/api/user/photo-submissions/index.get'
  import { useContributionScrollRestoration } from '~/composables/use-contribution-scroll-restoration'
  import { useContributionFeedback } from '~/composables/use-contribution-feedback'
  import { useContributionFilters } from '~/composables/use-contribution-filters'
  import FidgetSpinner from '~/components/FidgetSpinner.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appLocations } from '~/utils/navigation'
  import { createItemSubmissionCard, createPhotoSubmissionCard } from '~/utils/contribution-cards'

  definePageMeta({
    layout: 'page',
    viewTransition: false
  })

  const { user } = useUserStore()
  const isGuest = computed(() => user.value.isGuest)
  const { hasFilters, includesGear, includesPhotos, statusQuery, filterSignature, statusOptions, typeOptions, changeStatus, changeType, clearFilters } = useContributionFilters()
  let photoController: globalThis.AbortController | null = null
  const requestFetch = useRequestFetch()
  const componentId = useId()
  const typeFilterName = `${componentId}-type`
  const statusFilterName = `${componentId}-status`
  const gearHeadingId = `${componentId}-gear`
  const photoHeadingId = `${componentId}-photos`
  const filtersPanel = useTemplateRef('filtersPanel')
  const gearSection = useTemplateRef('gearSection')
  const photoSection = useTemplateRef('photoSection')
  const photoPaginationStatus = useTemplateRef('photoPaginationStatus')
  const appendedPhotoSubmissions = ref<UserPhotoSubmission[]>([])
  const nextPhotoPage = ref<number | null>(null)
  const isLoadingMorePhotos = ref(false)
  const hasPhotoLoadMoreError = ref(false)
  const isPhotoPaginationComplete = ref(false)

  const {
    data: itemSubmissions,
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

  const isLoadingGear = computed(() => includesGear.value && (itemSubmissionsStatus.value === 'pending' || itemSubmissionsStatus.value === 'idle'))
  const isLoadingPhotos = computed(() => includesPhotos.value && (photoSubmissionsStatus.value === 'pending' || photoSubmissionsStatus.value === 'idle'))
  const isLoading = computed(() => isLoadingGear.value || isLoadingPhotos.value)

  useContributionScrollRestoration(isLoading)

  const hasGearError = computed(() => includesGear.value && itemSubmissionsStatus.value === 'error')
  const hasPhotosError = computed(() => includesPhotos.value && photoSubmissionsStatus.value === 'error')
  const hasError = computed(() => hasGearError.value || hasPhotosError.value)
  const hasItemSubmissions = computed(() => includesGear.value && itemSubmissions.value.items.length > 0)
  const hasNoGearResults = computed(() => hasItemSubmissions.value === false)

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
  const hasNoPhotoResults = computed(() => hasPhotoSubmissions.value === false)
  const hasMorePhotoSubmissions = computed(() => nextPhotoPage.value !== null)
  const hasResults = computed(() => hasItemSubmissions.value || hasPhotoSubmissions.value)
  const hasNoContributions = computed(() => hasResults.value === false && isLoading.value === false && hasError.value === false)
  const hasNoMatchingContributions = computed(() => hasNoContributions.value && hasFilters.value)
  const gearEmptyMessage = computed(() => hasFilters.value ? 'No gear contributions match these filters.' : 'No gear contributions yet.')
  const photoEmptyMessage = computed(() => hasFilters.value ? 'No photo contributions match these filters.' : 'No photo contributions yet.')

  const { announcement, handleClearFilters } = useContributionFeedback({
    filtersPanel,
    hasError,
    hasFilters,
    hasNoContributions,
    hasResults,
    isLoading,
    resetFilters: clearFilters
  })

  const itemSubmissionCards = computed(() => itemSubmissions.value.items.map(createItemSubmissionCard))
  const photoSubmissionCards = computed(() => allPhotoSubmissions.value.map(createPhotoSubmissionCard))

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

  async function retrySection(type: 'gear' | 'photos', event: MouseEvent) {
    const ownedFocus = event.currentTarget === globalThis.document.activeElement
    const refresh = type === 'gear' ? refreshItemSubmissions : refreshPhotoSubmissions

    await refresh({ dedupe: 'cancel' })
    await nextTick()

    if (ownedFocus && globalThis.document.activeElement === globalThis.document.body) {
      const section = type === 'gear' ? gearSection.value : photoSection.value
      const focusTarget = section ?? filtersPanel.value?.querySelector<HTMLInputElement>('input:checked')

      focusTarget?.focus()
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

  // Keep the rendered list until the router saves its outgoing scroll position.
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
    grid-template-areas: "type reset" "status status";
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: var(--spacing-12);
    padding-block-end: var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);

    @container (width < 18rem) {
      grid-template-areas: "type" "status" "reset";
      grid-template-columns: minmax(0, 1fr);
    }

    @container (width >= 48rem) {
      grid-template-areas: "type status reset";
      grid-template-columns: minmax(12rem, 18rem) minmax(20rem, 28rem) 1fr;
      gap: var(--spacing-24);
    }
  }

  .typeFilter {
    grid-area: type;
  }

  .statusFilter {
    grid-area: status;
  }

  .filterLabel {
    margin-block-end: var(--spacing-8);
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
  }

  .typeChoices,
  .statusChoices {
    display: grid;
    gap: var(--spacing-4);
  }

  .typeChoices {
    grid-template-columns: repeat(3, minmax(0, 1fr));

    @container (width < 18rem) {
      grid-template-columns: repeat(3, auto);
    }
  }

  .statusChoices {
    grid-template-columns: repeat(4, minmax(0, 1fr));

    @container (width < 18rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .choice {
    position: relative;
    display: flex;
    cursor: pointer;
  }

  .radio {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .choiceLabel {
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-8) var(--spacing-4);
    border: 1px solid var(--color-text-tertiary);
    border-radius: var(--border-radius-10);
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    text-align: center;

    .choice:hover & {
      background: var(--color-accent-subtle-hover);
    }

    .radio:checked + & {
      border-color: var(--color-accent-primary);
      background: var(--color-accent-primary);
      color: var(--color-accent-contrast);
    }

    .radio:focus-visible + & {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 3px;
    }

    @media (forced-colors: active) {
      .radio:checked + & {
        outline: 3px solid Highlight;
        outline-offset: -4px;
      }

      .radio:focus-visible + & {
        outline: 2px dashed ButtonText;
        outline-offset: 3px;
      }
    }
  }

  .reset {
    grid-area: reset;
    justify-self: end;
    visibility: hidden;

    &:global(.isActive) {
      visibility: visible;
    }
  }

  .content {
    display: grid;
    gap: var(--spacing-32);
  }

  .section,
  .list {
    display: grid;
    gap: var(--spacing-12);
  }

  .sectionMessage,
  .sectionError {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-14);
    color: var(--color-text-secondary);
    background: var(--color-surface-primary);
  }

  .sectionError {
    justify-content: space-between;
    border-color: var(--color-danger-border);
  }

  .card {
    display: grid;
    gap: var(--spacing-8);
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-14);
    background: var(--color-surface-primary);
  }

  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--spacing-12);
    align-items: start;
  }

  .titleGroup {
    display: grid;
    gap: var(--spacing-4);
  }

  .cardTitle {
    color: var(--color-text-primary);
    font-size: var(--font-size-17);
    font-weight: var(--font-weight-semibold);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .references,
  .submitted {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    overflow-wrap: anywhere;
  }

  .statusPill {
    padding: var(--spacing-4) var(--spacing-8);
    border-radius: var(--border-radius-pill);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);

    &:global(.warning) {
      background: var(--color-warning-subtle);
    }

    &:global(.success) {
      background: var(--color-success-subtle);
    }

    &:global(.danger) {
      background: var(--color-danger-subtle);
    }
  }

  .detailsToggle {
    inline-size: fit-content;
    min-block-size: var(--layout-touch-target);
    padding-block: var(--spacing-12);
    color: var(--color-accent-primary);
    font-size: var(--font-size-14);
    cursor: pointer;
    border-radius: var(--border-radius-6);

    &:hover {
      text-decoration: underline;
      text-underline-offset: 0.2em;
    }

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }
  }

  .detailsBody {
    display: grid;
    gap: var(--spacing-16);
    padding-block: var(--spacing-12);
    border-block-start: 1px solid var(--color-border-subtle);
    font-size: var(--font-size-14);
  }

  .metadata,
  .propertyList {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: var(--spacing-12);
    color: var(--color-text-secondary);
  }

  .metadataGroup,
  .property,
  .properties,
  .rejection {
    display: grid;
    gap: var(--spacing-4);
  }

  .metadataGroup dt,
  .property dt,
  .sectionTitle {
    font-weight: var(--font-weight-semibold);
  }

  .sectionTitle {
    color: var(--color-text-secondary);
  }

  .rejection {
    padding: var(--spacing-12);
    border-inline-start: 3px solid var(--color-danger-primary);
    border-radius: var(--border-radius-6);
    background: var(--color-danger-subtle);
    font-size: var(--font-size-14);
    overflow-wrap: anywhere;
  }

  .loadMore {
    justify-self: start;
    white-space: normal;
  }

  .paginationStatus {
    color: var(--color-text-secondary);
  }
</style>
