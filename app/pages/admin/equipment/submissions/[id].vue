<template>
  <PageContent page-title="Review gear submission">
    <template #actions>
      <PerdLink :to="appLocations.adminEquipmentSubmissions">
        Back to submissions
      </PerdLink>
    </template>

    <PageLoadingState v-if="isInitialLoading" title="Loading gear submission" />

    <PagePlaceholder
      v-else-if="hasInitialError"
      emoji="🧰"
      title="Gear submission unavailable."
    >
      It may have already left the pending review queue.

      <template #actions>
        <PerdButton variant="secondary" @click="refreshSubmission()">
          Retry
        </PerdButton>
      </template>
    </PagePlaceholder>

    <div
      v-else-if="decisionStatus"
      ref="decisionStatusElement"
      role="status"
      tabindex="-1"
    >
      <PagePlaceholder
        :emoji="decisionStatus.emoji"
        :title="decisionStatus.title"
      >
        {{ decisionStatus.message }}

        <template #actions>
          <PerdLink :to="appLocations.adminEquipmentSubmissions">
            Back to submissions
          </PerdLink>
        </template>
      </PagePlaceholder>
    </div>

    <div v-else-if="editorValue" :class="$style.component">
      <dl :class="$style.metadata">
        <div :class="$style.metadataGroup">
          <dt :class="$style.metadataTerm">Submitted by</dt>
          <dd>{{ authorLabel }}</dd>
        </div>

        <div :class="$style.metadataGroup">
          <dt :class="$style.metadataTerm">Submitted at</dt>
          <dd>
            <time :datetime="submittedDateTime">{{ submittedDateLabel }}</time>
          </dd>
        </div>

        <div :class="$style.metadataGroup">
          <dt :class="$style.metadataTerm">Source</dt>
          <dd>
            <a
              v-if="hasSourceUrl"
              :href="sourceUrl"
              rel="noopener noreferrer"
              target="_blank"
            >
              Open source (opens in a new tab)
            </a>

            <span v-else>Not provided</span>
          </dd>
        </div>
      </dl>

      <p
        v-if="hasStatusMessage"
        ref="saveStatus"
        :class="$style.statusMessage"
        role="status"
        tabindex="-1"
      >
        {{ statusMessage }}
      </p>

      <EquipmentItemEditor
        :key="editorKey"
        :autofocus="shouldAutofocusEditor"
        :properties-conflict="isConflict"
        @reload="reloadAfterConfirmation"
        :initial-value="editorValue"
        :is-submitting="isEditorBusy"
        mode="review"
        :mutation-message="mutationMessage"
        @publish="publishSubmission"
        @reject="rejectSubmission"
        @submit="saveChanges"
      />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute } from '#imports'
  import EquipmentItemEditor, { type EquipmentItemEditorValue } from '~/components/equipment/EquipmentItemEditor.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { logUnexpectedCategoryPropertiesError } from '~/utils/category-properties-error'
  import { appLocations } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute('admin-equipment-submissions-id')
  const requestFetch = useRequestFetch()
  const decisionStatusElement = useTemplateRef('decisionStatusElement')
  const saveStatus = useTemplateRef('saveStatus')
  const submissionId = route.params.id
  const detailPath = `/api/equipment/item-submissions/${submissionId}` as const
  const isSubmitting = ref(false)
  const isConflict = ref(false)
  const editorKey = ref(0)
  const shouldAutofocusEditor = computed(() => editorKey.value > 0)
  const isReloadingSubmission = ref(false)
  const isEditorBusy = computed(() => isSubmitting.value || isReloadingSubmission.value)
  const mutationMessage = ref<string | null>(null)
  const statusMessage = ref<string | null>(null)
  const hasStatusMessage = computed(() => statusMessage.value !== null)

  const {
    data: submissionResponse,
    error: submissionError,
    refresh: refreshSubmission,
    status: submissionStatus
  } = await useFetch(detailPath)

  const submission = shallowRef(submissionResponse.value)
  const isInitialLoading = computed(() => submissionStatus.value === 'pending' && submission.value === undefined)
  const hasInitialError = computed(() => submissionError.value !== undefined && submission.value === undefined)
  const sourceUrl = computed(() => submission.value?.sourceUrl ?? '')
  const hasSourceUrl = computed(() => sourceUrl.value !== '')

  const decisionStatus = computed(() => {
    const status = submission.value?.status

    if (status === 'approved') {
      return {
        emoji: '✅',
        message: 'The corrected item is now visible in Gear library.',
        title: 'Published'
      }
    }

    if (status === 'rejected') {
      return {
        emoji: '🛑',
        message: 'The author can now see the rejection reason.',
        title: 'Rejected'
      }
    }

    return null
  })

  const editorValue = computed<EquipmentItemEditorValue | null>(() => {
    const { value } = submission

    if (value === undefined) {
      return null
    }

    return {
      brandId: value.brand.id,
      categoryId: value.category.id,
      name: value.name,
      properties: value.properties,
      expectedOriginalPropertiesRevision: value.propertiesRevision
    }
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

  const submittedDate = computed(() => new Date(submission.value?.createdAt ?? 0))
  const submittedDateTime = computed(() => submittedDate.value.toISOString())

  const submittedDateFormatter = new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric'
  })

  const submittedDateLabel = computed(() => submittedDateFormatter.format(submittedDate.value))

  watch(submissionResponse, (value) => {
    if (value !== undefined) {
      submission.value = value
    }
  })

  function getStatusCode(error: unknown) {
    if (typeof error !== 'object' || error === null) {
      return null
    }

    const statusCode = Reflect.get(error, 'statusCode')

    return typeof statusCode === 'number' ? statusCode : null
  }

  async function reloadAfterConfirmation() {
    if (isReloadingSubmission.value) {
      return
    }

    isReloadingSubmission.value = true

    await refreshSubmission()

    if (submissionError.value === undefined) {
      isConflict.value = false
      mutationMessage.value = null
      editorKey.value += 1
    } else {
      logUnexpectedCategoryPropertiesError('Could not reload the gear submission.', submissionError.value)

      mutationMessage.value = 'Could not reload the submission. Your draft is still here. Try again.'
    }

    isReloadingSubmission.value = false
  }

  async function mutateSubmission(
    body: EquipmentItemEditorValue,
    decision?: 'publish' | 'reject',
    rejectionReason?: string
  ) {
    const currentSubmission = submission.value

    if (currentSubmission === undefined
      || body.expectedPropertiesRevision === undefined
      || body.expectedOriginalPropertiesRevision === undefined) {
      return
    }

    mutationMessage.value = null
    statusMessage.value = null
    isSubmitting.value = true

    try {
      const updatedAt = new Date(currentSubmission.updatedAt)
      const expectedUpdatedAt = updatedAt.toISOString()

      const response = await requestFetch(detailPath, {
        body: {
          brandId: body.brandId,
          categoryId: body.categoryId,
          decision,
          expectedPropertiesRevision: body.expectedPropertiesRevision,
          expectedOriginalPropertiesRevision: body.expectedOriginalPropertiesRevision,
          expectedUpdatedAt,
          name: body.name,
          properties: body.properties,
          rejectionReason
        },

        method: 'PATCH'
      })

      submissionResponse.value = response

      if (decision === undefined) {
        statusMessage.value = 'Changes saved.'

        await nextTick()
        saveStatus.value?.focus()

        return
      }

      await nextTick()
      decisionStatusElement.value?.focus()
    } catch (error) {
      const statusCode = getStatusCode(error)

      if (statusCode === 409) {
        isConflict.value = true

        return
      }

      mutationMessage.value = decision === undefined
        ? 'Could not save changes. Your edits are still here. Try again.'
        : 'Could not apply this decision. Your edits are still here. Try again.'
    } finally {
      isSubmitting.value = false
    }
  }

  async function saveChanges(body: EquipmentItemEditorValue) {
    await mutateSubmission(body)
  }

  async function publishSubmission(body: EquipmentItemEditorValue) {
    await mutateSubmission(body, 'publish')
  }

  async function rejectSubmission(body: EquipmentItemEditorValue, rejectionReason: string) {
    await mutateSubmission(body, 'reject', rejectionReason)
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .metadata {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-24);
    color: var(--color-text-tertiary);
  }

  .metadataGroup {
    display: grid;
    gap: var(--spacing-4);
  }

  .metadataTerm {
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .statusMessage {
    color: var(--color-success-primary);
  }
</style>
