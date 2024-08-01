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

    <CreateChecklistDialog
      v-model="isDialogOpened"
      :loading="isLoading"
      @submit="createChecklist"
    >
    </CreateChecklistDialog>

    <ChecklistsContainer :checklists="checklists" />
  </div>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue'
  import CreateChecklistDialog from '~/components/dialogs/CreateChecklistDialog.vue'
  import ChecklistsContainer from '~/components/checklists/ChecklistsContainer.vue';

  definePageMeta({
    title: 'Checklists'
  })

  const isDialogOpened = ref(false)
  const isLoading = ref(false)
  const { checklists, fetchChecklists } = await useChecklistsData()

  function openDialog() {
    isDialogOpened.value = true
  }

  async function createChecklist(name: string) {
    isLoading.value = true

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
    } finally {
      isLoading.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-32);
  }
</style>
