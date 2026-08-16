<template>
  <PageContent page-title="Submit missing gear">
    <template v-if="showFormBackLink" #actions>
      <PerdLink :to="appRoutes.gearLibrary">
        Back to Gear library
      </PerdLink>
    </template>

    <PagePlaceholder v-if="isGuest" emoji="🔐" title="Account required.">
      Guest accounts cannot submit gear for review. Account upgrade options will be available later.
    </PagePlaceholder>

    <div v-else>
      <div v-if="isSubmitted" :class="$style.confirmation">
        <p ref="confirmationStatus" role="status" tabindex="-1">
          Submitted for review. It will not appear in Gear library, My gear, or packing lists until an administrator approves it.
        </p>

        <div :class="$style.actions">
          <PerdButton @click="startAnotherSubmission">
            Submit another item
          </PerdButton>

          <PerdLink :to="appRoutes.gearLibrary">
            Back to Gear library
          </PerdLink>

          <PerdLink :to="appRoutes.accountSubmissions">
            View My contributions
          </PerdLink>
        </div>
      </div>

      <EquipmentItemEditor
        v-else
        :key="editorKey"
        :autofocus="shouldAutofocusEditor"
        :initial-value="emptyValue"
        :is-submitting="isSubmitting"
        mode="create"
        :mutation-message="mutationMessage"
        @submit="handleSubmit"
      />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef } from 'vue'
  import { definePageMeta, useRequestFetch, useUserStore } from '#imports'
  import EquipmentItemEditor, { type EquipmentItemEditorValue } from '~/components/equipment/EquipmentItemEditor.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import { appRoutes } from '~/utils/navigation'

  definePageMeta({ layout: 'page' })

  const emptyValue: EquipmentItemEditorValue = {
    brandId: 0,
    categoryId: 0,
    name: '',
    properties: []
  }

  const requestFetch = useRequestFetch()
  const { user } = useUserStore()
  const confirmationStatus = useTemplateRef('confirmationStatus')
  const isSubmitting = ref(false)
  const isSubmitted = ref(false)
  const editorKey = ref(0)
  const shouldAutofocusEditor = ref(false)
  const mutationMessage = ref<string | null>(null)
  const isGuest = computed(() => user.value.isGuest)
  const showFormBackLink = computed(() => isGuest.value || isSubmitted.value === false)

  function startAnotherSubmission() {
    mutationMessage.value = null
    shouldAutofocusEditor.value = true
    editorKey.value += 1
    isSubmitted.value = false
  }

  async function handleSubmit(body: EquipmentItemEditorValue) {
    mutationMessage.value = null
    isSubmitting.value = true

    try {
      await requestFetch('/api/equipment/item-submissions', { body, method: 'POST' })
      isSubmitted.value = true

      await nextTick()

      confirmationStatus.value?.focus()
    } catch {
      mutationMessage.value = 'Could not submit item. Try again.'
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<style module>
  .confirmation {
    display: grid;
    gap: var(--spacing-16);
    max-inline-size: 44rem;
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-12);
  }
</style>
