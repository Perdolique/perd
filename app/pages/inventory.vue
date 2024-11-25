<template>
  <div :class="$style.component">
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

    <PerdTable
      v-if="hasItems"
      :data="equipment"
      :columns="columns"
      key-field="id"
    >
      <template #name="{ rowData }">
        <PerdLink
          :class="$style.nameLink"
          :to="`/equipment/item/${rowData.id}`"
        >
          {{ rowData.name }}
        </PerdLink>
      </template>

      <template #weight="{ rowData }">
        {{ rowData.weight }}
      </template>

      <template #actions="{ rowData }">
        <div :class="$style.actions">
          <PerdButton
            small
            secondary
            icon="tabler:trash"
            @click="removeItem(rowData)"
          >
            Retire
          </PerdButton>
        </div>
      </template>
    </PerdTable>

    <EmptyState
      v-else
      icon="tabler:backpack"
    >
      Inventory is empty
    </EmptyState>
  </div>
</template>

<script lang="ts" setup>
  import SearchOptionAdd from '~/components/PerdSearch/SearchOptionAdd.vue';
  import PerdSearch from '~/components/PerdSearch/PerdSearch.vue';
  import EmptyState from '~/components/EmptyState.vue';
  import PerdTable from '~/components/PerdTable/PerdTable.vue';
  import PerdButton from '~/components/PerdButton.vue';
  import PerdLink from '~/components/PerdLink.vue';

  interface EquipmentItem {
    readonly id: number;
    readonly name: string;
    readonly weight: number;
    readonly createdAt: string;
  }

  definePageMeta({
    title: 'Inventory'
  })

  const columns = [
    { key: 'name',   label: 'Name' },
    { key: 'weight', label: 'Weight' },
    { key: 'actions' }
  ]

  const isSearching = ref(false);
  const options = ref<EquipmentItem[]>([]);
  const { equipment, refetchEquipment } = await useUserEquipment()
  const hasItems = computed(() => equipment.value.length > 0)

  async function search(searchString: string) {
    try {
      isSearching.value = true;

      const resultPromise = $fetch('/api/search/equipment', {
        params: {
          searchString,
          filterOwned: true
        }
      })

      const result = await withMinimumDelay(resultPromise)

      options.value = result.map((equipment) => ({
        id: equipment.id,
        key: equipment.id.toString(),
        name: equipment.name,
        weight: equipment.weight,
        createdAt: equipment.createdAt
      }));
    } catch (error) {
      console.error(error);
    } finally {
      isSearching.value = false
    }
  }

  async function addItem(item: EquipmentItem) {
    try {
      await $fetch('/api/inventory', {
        method: 'POST',

        body: {
          equipmentId: item.id
        }
      })

      options.value = options.value.filter(({ id }) => id !== item.id)

      await refetchEquipment()
    } catch (error) {
      console.error(error)
    }
  }

  async function removeItem(item: EquipmentItem) {
    try {
      await $fetch(`/api/inventory/${item.id}`, {
        method: 'DELETE'
      })

      await refetchEquipment()
    } catch (error) {
      console.error(error)
    }
  }
</script>

<style lang="scss" module>
  .component {
    display: grid;
    row-gap: var(--spacing-24);
  }

  .search {
    @include mobileLarge() {
      max-width: var(--screen-mobile-s);
    }
  }

  .nameLink {
    font-weight: var(--font-weight-medium);
  }

  .actions {
    display: flex;
    justify-content: end;
  }
</style>
