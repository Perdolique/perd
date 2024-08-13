<template>
  <PageContent :page-title="name">
    <template #actions>
      <div :class="$style.actions">
        <PerdButton
          small
          icon="tabler:toggle-left"
        >
          Toggle mode
        </PerdButton>

        <PerdMenu
          icon="tabler:settings"
          :items="menuItems"
          @item-click="handleMenuItemClick"
        >
          Options
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

      <ChecklistItemsList :items="items" />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue';
  import SearchOptionAdd from '~/components/PerdSearch/SearchOptionAdd.vue';
  import PerdSearch from '~/components/PerdSearch/PerdSearch.vue';
  import ChecklistItemsList from '~/components/checklists/ChecklistItemsList.vue';
  import PerdMenu, { type MenuItem } from '~/components/PerdMenu.vue';

  definePageMeta({
    layout: 'page'
  })

  interface InventoryItem {
    readonly id: string;
    readonly name: string;
  }

  const menuItems = [{
    icon: 'tabler:trash',
    text: 'Delete',
    event: 'delete'
  }] as const satisfies MenuItem[]

  const route = useRoute()
  const { items, addItem } = useChecklistStore()
  const name = ref('')
  const checklistId = route.params.checklistId?.toString() ?? ''
  const isDeleting = ref(false)
  const options = ref<InventoryItem[]>([])
  const isSearching = ref(false)
  const { data: checklistData } = await useFetch(`/api/checklists/${checklistId}`)

  await useChecklistItemsData(checklistId)

  if (checklistData.value !== undefined) {
    name.value = checklistData.value.name
  } else {
    await navigateTo('/checklists', {
      replace: true
    })
  }

  async function deleteChecklist() {
    try {
      isDeleting.value = true

      await $fetch(`/api/checklists/${checklistId}`, {
        method: 'DELETE'
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

      const resultPromise = $fetch('/api/inventory', {
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

  async function handleOptionClick(equipmentId: string) {
    await addItem(checklistId, equipmentId)

    options.value = options.value.filter(({ id }) => id !== equipmentId)
  }

  async function handleMenuItemClick(item: typeof menuItems[number]) {
    if (item.event === 'delete') {
      await deleteChecklist()
    }
  }
</script>

<style module>
  .content {
    display: grid;
    justify-items: start;
    gap: var(--spacing-32);
  }

  .actions {
    display: flex;
    align-items: center;
    column-gap: var(--spacing-8);
  }

  .search {
    width: 100%;
    max-width: 400px;
  }
</style>
