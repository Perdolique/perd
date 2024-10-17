<template>
  <PageContent :page-title="name">
    <template #actions>
      <div :class="$style.actions">
        <PerdButton
          v-if="isCheckMode"
          small
          secondary
          icon="tabler:plus"
          @click="resetAllToggles"
        >
          Reset
        </PerdButton>

        <PerdMenu
          icon="tabler:settings"
          text="Options"
        >
          <OptionButton
            icon="tabler:trash"
            @click="showDeleteConfirmation"
          >
            <template v-if="isDeleting">
              Deleting...
            </template>

            <template v-else>
              Delete
            </template>
          </OptionButton>

          <OptionToggle v-model="isCheckMode">
            Check mode
          </OptionToggle>
        </PerdMenu>
      </div>
    </template>

    <div :class="$style.content">
      <PerdSearch
        label="Search"
        placeholder="MGS Bubba Hubba UL2"
        :class="$style.search"
        :options="options"
        :debounce="500"
        :searching="isSearching"
        @search="search"
      >
        <template #option="{ option }">
          <SearchOptionAdd @click="handleOptionClick(option.id)">
            {{ option.name }}
          </SearchOptionAdd>
        </template>
      </PerdSearch>

      <ChecklistItemsList
        v-if="hasItems"
        :items="items"
        :check-mode="isCheckMode"
        :checklist-id="checklistId"
      />

      <EmptyState
        v-else
        icon="tabler:clipboard-list"
      >
        No items yet
      </EmptyState>
    </div>
  </PageContent>

  <ConfirmationDialog
    v-model="isDeleteDialogOpened"
    header-text="Delete checklist"
    :confirm-button-text="deleteButtonText"
    @confirm="deleteChecklist"
  >
    Cheklist <strong>{{ name }}</strong> will be deleted
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import SearchOptionAdd from '~/components/PerdSearch/SearchOptionAdd.vue';
  import PerdSearch from '~/components/PerdSearch/PerdSearch.vue';
  import ChecklistItemsList from '~/components/checklists/ChecklistItemsList.vue';
  import PerdMenu from '~/components/PerdMenu.vue';
  import OptionButton from '~/components/PerdMenu/OptionButton.vue';
  import OptionToggle from '~/components/PerdMenu/OptionToggle.vue';
  import PerdButton from '~/components/PerdButton.vue';
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import EmptyState from '~/components/EmptyState.vue';

  definePageMeta({
    layout: 'page'
  })

  interface InventoryItem {
    readonly id: number;
    readonly name: string;
  }

  const route = useRoute()
  const { items, addItem } = useChecklistStore()
  const hasItems = computed(() => items.value.length > 0)
  const { addToast } = useToaster()
  const name = ref('')
  const checklistId = route.params.checklistId?.toString() ?? ''
  const isDeleting = ref(false)
  const options = ref<InventoryItem[]>([])
  const isSearching = ref(false)
  const isCheckMode = ref(false)
  const isDeleteDialogOpened = ref(false)
  const { resetAll: resetAllToggles } = useChecklistToggle(checklistId)
  const { data: checklistData } = await useFetch(`/api/checklists/${checklistId}`)
  const deleteButtonText = computed(() => `Delete ${name.value}`)

  await useChecklistItemsData(checklistId)

  if (checklistData.value !== undefined) {
    name.value = checklistData.value.name
  } else {
    await navigateTo('/checklists', {
      replace: true
    })
  }

  async function deleteChecklist() {
    if (isDeleting.value) {
      return
    }

    try {
      isDeleting.value = true

      await $fetch(`/api/checklists/${checklistId}`, {
        method: 'DELETE'
      })

      addToast({
        title: 'Checklist deleted',
        message: `Checklist ${name.value} has been deleted`
      })

      await navigateTo('/checklists', {
        replace: true
      })
    } catch (error) {
      console.error(error)
    } finally {
      isDeleting.value = false
    }
  }

  async function search(searchString: string) {
    try {
      isSearching.value = true;

      const resultPromise = $fetch('/api/search/checklist-inventory', {
        params: {
          search: searchString,
          checklistId: checklistId
        }
      })

      const result = await withMinimumDelay(resultPromise)

      options.value = result.map((equipment) => ({
        id: equipment.id,
        name: equipment.name
      }));
    } catch (error) {
      console.error(error);
    } finally {
      isSearching.value = false
    }
  }

  async function handleOptionClick(equipmentId: number) {
    await addItem(checklistId, equipmentId)

    options.value = options.value.filter(({ id }) => id !== equipmentId)
  }

  function showDeleteConfirmation() {
    isDeleteDialogOpened.value = true
  }
</script>

<style module>
  .content {
    display: grid;
    gap: var(--spacing-32);
  }

  .actions {
    display: flex;
    align-items: center;
    column-gap: var(--spacing-8);
    isolation: isolate;
    z-index: 2;
  }

  .search {
    width: 100%;
    max-width: 400px;
    isolation: isolate;
    z-index: 1;
  }
</style>
