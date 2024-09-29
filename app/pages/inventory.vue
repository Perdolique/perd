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

    <EquipmentTable
      v-if="hasItems"
      :equipment="equipment"
      @remove="removeItem"
    />

    <EmptyState
      v-else
      icon="tabler:backpack"
    >
      Inventory is empty
    </EmptyState>
  </div>
</template>

<script lang="ts" setup>
  import EquipmentTable from '~/components/equipment/EquipmentTable.vue';
  import SearchOptionAdd from '~/components/PerdSearch/SearchOptionAdd.vue';
  import PerdSearch from '~/components/PerdSearch/PerdSearch.vue';
  import EmptyState from '~/components/EmptyState.vue';

  interface EquipmentItem {
    readonly id: number;
    readonly name: string;
    readonly weight: number;
    readonly createdAt: string;
  }

  definePageMeta({
    title: 'Inventory'
  })

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
</style>
