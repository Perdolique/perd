<template>
  <PageContent :page-title="name">
    <div :class="$style.content">
      <PerdButton
        :disabled="isDeleting"
        @click="deleteChecklist"
      >
        Delete
      </PerdButton>

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
          <SearchOptionAdd @click="addItem(option)">
            {{ option.name }}
          </SearchOptionAdd>
        </template>
      </PerdSearch>

      <ChecklistItemsList :items="items" />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/page-content.vue'
  import PerdButton from '~/components/PerdButton.vue';
  import SearchOptionAdd from '~/components/PerdSearch/SearchOptionAdd.vue';
  import PerdSearch from '~/components/PerdSearch/PerdSearch.vue';
  import ChecklistItemsList from '~/components/checklists/ChecklistItemsList.vue';

  interface InventoryItem {
    readonly id: string;
    readonly name: string;
  }

  const route = useRoute()
  const name = ref('')
  const checklistId = route.params.id?.toString() ?? ''
  const isDeleting = ref(false)
  const options = ref<InventoryItem[]>([]);
  const isSearching = ref(false);
  const { data: checklistData } = await useFetch(`/api/checklists/${checklistId}`)
  const items = await useChecklistItemsData(checklistId)

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

  async function addItem(item: InventoryItem) {
    try {
      const insertedItem = await $fetch(`/api/checklists/${checklistId}/items`, {
        method: 'POST',

        body: {
          equipmentId: item.id
        }
      })

      options.value = options.value.filter(({ id }) => id !== item.id)

      if (insertedItem !== undefined) {
        items.value.push({
          id: insertedItem.id,
          equipment: insertedItem.equipment
        })
      }
    } catch (error) {
      console.error(error)
    }
  }
</script>

<style module>
  .content {
    display: grid;
    justify-items: start;
    gap: var(--spacing-32);
  }

  .search {
    width: 100%;
    max-width: 400px;
  }
</style>
