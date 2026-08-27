<template>
  <PageContent page-title="Review photo submission">
    <template #actions>
      <PerdLink :to="appRoutes.adminEquipmentPhotoSubmissions">
        Back to photo submissions
      </PerdLink>
    </template>

    <PageLoadingState v-if="isInitialLoading" title="Loading photo submission" />

    <PagePlaceholder
      v-else-if="hasInitialError"
      emoji="📷"
      title="Photo submission unavailable."
    >
      It may have already left the pending review queue.

      <template #actions>
        <PerdButton variant="secondary" @click="retryInitialLoad">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <div
      v-else-if="isConflict"
      ref="conflictStatus"
      role="alert"
      tabindex="-1"
    >
      <PagePlaceholder emoji="🚦" title="This photo was already reviewed.">
        Reload the photo review queue before making another decision.

        <template #actions>
          <PerdLink :to="appRoutes.adminEquipmentPhotoSubmissions">
            Return to photo submissions
          </PerdLink>
        </template>
      </PagePlaceholder>
    </div>

    <div
      v-else-if="decisionStatus"
      ref="decisionStatusElement"
      role="status"
      tabindex="-1"
    >
      <PagePlaceholder :emoji="decisionStatus.emoji" :title="decisionStatus.title">
        {{ decisionStatus.message }}

        <template #actions>
          <PerdLink :to="appRoutes.adminEquipmentPhotoSubmissions">
            Back to photo submissions
          </PerdLink>

          <PerdLink :to="itemPath">
            View catalog item
          </PerdLink>
        </template>
      </PagePlaceholder>
    </div>

    <div v-else-if="hasSubmission" :class="$style.component">
      <PerdCard :class="$style.previewCard">
        <p v-if="isPreviewLoading" role="status">
          Loading private photo preview…
        </p>

        <div v-if="hasPreviewError" :class="$style.previewError" role="alert">
          <p>Could not load the private photo preview.</p>

          <PerdButton variant="secondary" @click="retryPreview">
            Retry preview
          </PerdButton>
        </div>

        <img
          :class="$style.preview"
          :hidden="isPreviewHidden"
          :src="previewSource"
          :alt="previewAlt"
          @error="handlePreviewError"
          @load="handlePreviewLoad"
        >
      </PerdCard>

      <PerdCard :class="$style.detailsCard">
        <div :class="$style.itemHeading">
          <PerdHeading :level="2">Catalog item</PerdHeading>
          <PerdLink :to="itemPath">{{ itemName }}</PerdLink>
          <p :class="$style.references">{{ brandAndCategory }}</p>
        </div>

        <dl :class="$style.metadata">
          <div :class="$style.metadataGroup">
            <dt>Submitted by</dt>
            <dd>{{ authorLabel }}</dd>
          </div>

          <div :class="$style.metadataGroup">
            <dt>Submitted at</dt>
            <dd><time :datetime="submittedDateTime">{{ submittedDateLabel }}</time></dd>
          </div>

          <div :class="$style.metadataGroup">
            <dt>Filename</dt>
            <dd>{{ filename }}</dd>
          </div>

          <div :class="$style.metadataGroup">
            <dt>Source</dt>
            <dd>{{ sourceLabel }}</dd>
          </div>

          <div :class="$style.metadataGroup">
            <dt>Rights confirmed</dt>
            <dd>{{ rightsLabel }}</dd>
          </div>
        </dl>

        <a
          v-if="hasSourceUrl"
          :href="sourceUrl"
          rel="noopener noreferrer"
          target="_blank"
        >
          Open manufacturer source
        </a>
      </PerdCard>

      <PerdCard :class="$style.decisionCard">
        <label :class="$style.primaryControl">
          <input
            v-model="makePrimary"
            type="checkbox"
            :disabled="isPrimaryControlDisabled"
          >
          Make primary image
        </label>

        <p v-if="isFirstImage" :class="$style.primaryHint">
          This is the first gallery image, so it will become primary automatically.
        </p>

        <p v-if="hasMutationError" :class="$style.mutationError" role="alert">
          {{ mutationError }}
        </p>

        <div :class="$style.buttons">
          <PerdButton :disabled="isDecisionDisabled" @click="openPublishConfirmation">
            Publish
          </PerdButton>

          <PerdButton
            variant="danger"
            :disabled="isDecisionDisabled"
            @click="openRejectConfirmation"
          >
            Reject
          </PerdButton>
        </div>
      </PerdCard>
    </div>

    <ConfirmationDialog
      v-model="showPublishConfirmation"
      :close-on-confirm="false"
      confirm-button-text="Publish"
      :confirm-loading="isSubmitting"
      header-text="Publish photo submission"
      @confirm="publishSubmission"
    >
      Publish this photo to the catalog gallery?
    </ConfirmationDialog>

    <ConfirmationDialog
      v-model="showRejectConfirmation"
      :close-on-confirm="false"
      confirm-button-text="Reject"
      :confirm-disabled="isRejectConfirmDisabled"
      :confirm-loading="isSubmitting"
      confirm-variant="danger"
      header-text="Reject photo submission"
      @confirm="rejectSubmission"
    >
      <TextInput
        v-model="rejectionReason"
        label="Reason"
        name="rejection-reason"
        :disabled="isSubmitting"
        :maxlength="maxRejectionReasonLength"
        required
      />
    </ConfirmationDialog>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute } from '#imports'
  import { limits } from '#shared/constants'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdCard from '~/components/PerdCard.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import TextInput from '~/components/TextInput.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes, createGearLibraryItemPath } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute()
  const requestFetch = useRequestFetch()
  const conflictStatus = useTemplateRef('conflictStatus')
  const decisionStatusElement = useTemplateRef('decisionStatusElement')
  const routeId = route.params.id
  const submissionId = Array.isArray(routeId) ? routeId[0] ?? '' : routeId ?? ''
  const detailPath = `/api/equipment/photo-submissions/${submissionId}` as const
  const maxRejectionReasonLength = limits.maxEquipmentItemRejectionReasonLength
  const previewAttempt = ref(0)
  const previewStatus = ref<'error' | 'loading' | 'ready'>('loading')
  const requestedMakePrimary = ref(false)
  const rejectionReason = ref('')
  const showPublishConfirmation = ref(false)
  const showRejectConfirmation = ref(false)
  const isSubmitting = ref(false)
  const isConflict = ref(false)
  const mutationError = ref<string | null>(null)
  const decision = ref<'approved' | 'rejected' | null>(null)

  const {
    data: submission,
    error: submissionError,
    refresh: refreshSubmission,
    status: submissionStatus
  } = await useFetch(detailPath)

  const isInitialLoading = computed(() => submissionStatus.value === 'pending')
  const hasInitialError = computed(() => submissionError.value !== undefined)
  const hasSubmission = computed(() => submission.value !== undefined)
  const isFirstImage = computed(() => submission.value?.hasExistingImages === false)

  const makePrimary = computed({
    get: () => isFirstImage.value || requestedMakePrimary.value,

    set: (value: boolean) => {
      requestedMakePrimary.value = value
    }
  })

  const isPrimaryControlDisabled = computed(() => isFirstImage.value || isSubmitting.value)
  const isPreviewLoading = computed(() => previewStatus.value === 'loading')
  const hasPreviewError = computed(() => previewStatus.value === 'error')
  const isPreviewReady = computed(() => previewStatus.value === 'ready')
  const isPreviewHidden = computed(() => isPreviewReady.value === false)
  const isDecisionDisabled = computed(() => isPreviewReady.value === false || isSubmitting.value)
  const hasMutationError = computed(() => mutationError.value !== null)
  const trimmedRejectionReason = computed(() => rejectionReason.value.trim())
  const isRejectConfirmDisabled = computed(() => isSubmitting.value || trimmedRejectionReason.value === '')
  const itemPath = computed(() => createGearLibraryItemPath(submission.value?.item.id ?? ''))
  const itemName = computed(() => submission.value?.item.name ?? '')

  const brandAndCategory = computed(() => {
    const item = submission.value?.item

    return item === undefined ? '' : `${item.brand.name} · ${item.category.name}`
  })

  const authorLabel = computed(() => {
    const author = submission.value?.author

    if (author === null) {
      return 'Deleted account'
    }

    if (author === undefined) {
      return ''
    }

    return author.name ?? `User ${author.id.slice(0, 8)}`
  })

  const filename = computed(() => submission.value?.filename ?? '')

  const sourceLabel = computed(() => submission.value?.sourceType === 'manufacturer'
    ? 'Official manufacturer photo'
    : 'Own photo')

  const sourceUrl = computed(() => submission.value?.sourceUrl ?? '')
  const hasSourceUrl = computed(() => sourceUrl.value !== '')
  const rightsLabel = computed(() => submission.value?.rightsConfirmed === true ? 'Yes' : 'No')
  const submittedDate = computed(() => new Date(submission.value?.createdAt ?? 0))
  const submittedDateTime = computed(() => submittedDate.value.toISOString())

  const submittedDateLabel = computed(() => new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric'
  }).format(submittedDate.value))

  const previewSource = computed(() => {
    const baseUrl = submission.value?.previewUrl ?? ''

    return `${baseUrl}?attempt=${previewAttempt.value}`
  })

  const previewAlt = computed(() => `Submitted photo ${filename.value}`)

  const decisionStatus = computed(() => {
    if (decision.value === 'approved') {
      return {
        emoji: '✅',
        message: 'The photo is now visible in the catalog gallery.',
        title: 'Published'
      }
    }

    if (decision.value === 'rejected') {
      return {
        emoji: '🛑',
        message: 'The author can now see the rejection reason.',
        title: 'Rejected'
      }
    }

    return null
  })

  function getStatusCode(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return null
    }

    const statusCode = Reflect.get(error, 'statusCode')

    return typeof statusCode === 'number' ? statusCode : null
  }

  async function retryInitialLoad() {
    await refreshSubmission()
  }

  function handlePreviewLoad() {
    previewStatus.value = 'ready'
  }

  function handlePreviewError() {
    previewStatus.value = 'error'
  }

  function retryPreview() {
    previewStatus.value = 'loading'
    previewAttempt.value += 1
  }

  function openPublishConfirmation() {
    if (isDecisionDisabled.value === false) {
      showPublishConfirmation.value = true
    }
  }

  function openRejectConfirmation() {
    if (isDecisionDisabled.value === false) {
      showRejectConfirmation.value = true
    }
  }

  async function applyDecision(
    body: { decision: 'publish'; makePrimary: boolean; } | { decision: 'reject'; rejectionReason: string; }
  ) {
    mutationError.value = null
    isSubmitting.value = true

    try {
      const response = await requestFetch(detailPath, {
        body,
        method: 'PATCH'
      })

      showPublishConfirmation.value = false
      showRejectConfirmation.value = false
      decision.value = response.status

      await nextTick()

      decisionStatusElement.value?.focus()
    } catch (error) {
      if (getStatusCode(error) === 409) {
        showPublishConfirmation.value = false
        showRejectConfirmation.value = false
        isConflict.value = true

        await nextTick()

        conflictStatus.value?.focus()

        return
      }

      mutationError.value = 'Could not apply this decision. Your choices are still here. Try again.'
    } finally {
      isSubmitting.value = false
    }
  }

  async function publishSubmission() {
    await applyDecision({
      decision: 'publish',
      makePrimary: makePrimary.value
    })
  }

  async function rejectSubmission() {
    if (isRejectConfirmDisabled.value) {
      return
    }

    await applyDecision({
      decision: 'reject',
      rejectionReason: trimmedRejectionReason.value
    })
  }
</script>

<style module>
  .component,
  .previewCard,
  .detailsCard,
  .decisionCard,
  .itemHeading,
  .previewError {
    display: grid;
    gap: var(--spacing-16);
  }

  .preview {
    inline-size: 100%;
    max-block-size: 42rem;
    border-radius: var(--border-radius-16);
    object-fit: contain;
  }

  .metadata {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: var(--spacing-16);
  }

  .metadataGroup {
    display: grid;
    gap: var(--spacing-4);

    & dt {
      color: var(--color-text-secondary);
      font-size: var(--font-size-14);
      font-weight: var(--font-weight-semibold);
    }
  }

  .references,
  .primaryHint {
    color: var(--color-text-tertiary);
  }

  .primaryControl {
    display: flex;
    gap: var(--spacing-8);
    align-items: center;
    font-weight: var(--font-weight-semibold);
  }

  .mutationError {
    color: var(--color-danger-primary);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-12);
  }
</style>
