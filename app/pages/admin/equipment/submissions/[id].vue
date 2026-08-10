<template>
  <PageContent page-title="Review gear submission">
    <template #actions>
      <PerdLink :to="appRoutes.adminEquipmentSubmissions">
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
      <PagePlaceholder
        emoji="🚦"
        title="This submission changed while you were reviewing it."
      >
        Reload the submission queue before making more changes.

        <template #actions>
          <PerdLink :to="appRoutes.adminEquipmentSubmissions">
            Return to submissions
          </PerdLink>
        </template>
      </PagePlaceholder>
    </div>

    <div
      v-else-if="decisionStatus !== null"
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
          <PerdLink :to="appRoutes.adminEquipmentSubmissions">
            Back to submissions
          </PerdLink>
        </template>
      </PagePlaceholder>
    </div>

    <div v-else-if="editorValue !== null" :class="$style.component">
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
      </dl>

      <p
        v-if="statusMessage !== null"
        ref="saveStatus"
        :class="$style.statusMessage"
        role="status"
        tabindex="-1"
      >
        {{ statusMessage }}
      </p>

      <EquipmentItemEditor
        :initial-value="editorValue"
        :is-submitting="isSubmitting"
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
  import { computed, nextTick, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useRoute } from '#imports'
  import EquipmentItemEditor, { type EquipmentItemEditorValue } from '~/components/equipment/EquipmentItemEditor.vue'
  import PageLoadingState from '~/components/PageLoadingState.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes } from '~/utils/navigation'

  definePageMeta({
    layout: 'page',
    middleware: 'admin'
  })

  const route = useRoute()
  const requestFetch = useRequestFetch()
  const conflictStatus = useTemplateRef('conflictStatus')
  const decisionStatusElement = useTemplateRef('decisionStatusElement')
  const saveStatus = useTemplateRef('saveStatus')
  const routeId = route.params.id
  const submissionId = Array.isArray(routeId) ? routeId[0] ?? '' : routeId ?? ''
  const detailPath = `/api/equipment/item-submissions/${submissionId}` as const
  const isSubmitting = ref(false)
  const isConflict = ref(false)
  const mutationMessage = ref<string | null>(null)
  const statusMessage = ref<string | null>(null)

  const {
    data: submission,
    error: submissionError,
    refresh: refreshSubmission,
    status: submissionStatus
  } = await useFetch(detailPath)

  const isInitialLoading = computed(() => submissionStatus.value === 'pending')
  const hasInitialError = computed(() => submissionError.value !== undefined)

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
      properties: value.properties
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

  const submittedDateLabel = computed(() => new Intl.DateTimeFormat('en', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric'
  }).format(submittedDate.value))

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

  async function mutateSubmission(
    body: EquipmentItemEditorValue,
    decision?: 'publish' | 'reject',
    rejectionReason?: string
  ) {
    const currentSubmission = submission.value

    if (currentSubmission === undefined) {
      return
    }

    mutationMessage.value = null
    statusMessage.value = null
    isSubmitting.value = true

    try {
      const response = await requestFetch(detailPath, {
        body: {
          brandId: body.brandId,
          categoryId: body.categoryId,
          decision,
          expectedUpdatedAt: new Date(currentSubmission.updatedAt).toISOString(),
          name: body.name,
          properties: body.properties,
          rejectionReason
        },
        method: 'PATCH'
      })

      submission.value = response
      if (decision === undefined) {
        statusMessage.value = 'Changes saved.'

        await nextTick()

        saveStatus.value?.focus()

        return
      }

      await nextTick()

      decisionStatusElement.value?.focus()
    } catch (error) {
      if (getStatusCode(error) === 409) {
        isConflict.value = true

        await nextTick()

        conflictStatus.value?.focus()

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
