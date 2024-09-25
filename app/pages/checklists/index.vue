<template>
  <div :class="$style.component">
    <div>
      <PerdButton
        :class="$style.button"
        @click="openDialog"
      >
        Create checklist
      </PerdButton>
    </div>

    <InputDialog
      v-model="isDialogOpened"
      header-text="Create checklist"
      placeholder="Checklist name"
      add-button-text="Create"
      :maxlength="limits.maxChecklistNameLength"
      @submit="createChecklist"
    />

    <ChecklistsContainer :checklists="checklists" />
  </div>
</template>

<script lang="ts" setup>
  import { limits } from '~~/constants';
  import PerdButton from '~/components/PerdButton.vue'
  import ChecklistsContainer from '~/components/checklists/ChecklistsContainer.vue';
  import InputDialog from '~/components/dialogs/InputDialog.vue';

  definePageMeta({
    title: 'Checklists'
  })

  const isDialogOpened = ref(false)
  const { checklists, fetchChecklists } = await useChecklistsData()

  function openDialog() {
    isDialogOpened.value = true
  }

  async function createChecklist(name: string) {
    try {
      const resultPromise = $fetch('/api/checklists', {
        method: 'POST',

        body: {
          name
        }
      })

      await withMinimumDelay(resultPromise)

      fetchChecklists()

      isDialogOpened.value = false
    } catch (error) {
      console.error(error)
    }
  }
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-32);
  }
</style>
