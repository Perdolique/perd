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
        <SearchOption @click="addItem(option)">
          {{ option.name }}
        </SearchOption>
      </template>
    </PerdSearch>

    <EquipmentTable
      :equipment="equipment"
      @remove="removeItem"
    />
  </div>
</template>

<script lang="ts" setup>
  import EquipmentTable from '~/components/equipment/EquipmentTable.vue';
  import SearchOption from '~/components/inventory/SearchOption.vue';
  import PerdSearch from '~/components/PerdSearch/PerdSearch.vue';

  interface EquipmentItem {
    readonly id: string;
    readonly name: string;
    readonly weight: number;
    readonly createdAt: string;
  }

  definePageMeta({
    title: 'Inventory'
  })

  const isSearching = ref(false);
  const options = ref<EquipmentItem[]>([]);
  const timer = ref(0);
  const { equipment, updateEquipment } = await useUserEquipment()

  async function search(searchString: string) {
    if (isSearching.value) {
      clearTimeout(timer.value);
    }

    try {
      isSearching.value = true;

      const delayPromise = delay(250)

      const resultPromise = $fetch('/api/equipment', {
        params: {
          searchString,
          filterOwned: true
        }
      })

      const [result] = await Promise.allSettled([resultPromise, delayPromise])

      if (result.status === 'fulfilled') {
        options.value = result.value.map((equipment) => ({
          id: equipment.id,
          name: equipment.name,
          weight: equipment.weight,
          createdAt: equipment.createdAt
        }));
      }
    } finally {
      isSearching.value = false
    }
  }

  async function addItem(item: EquipmentItem) {
    try {
      await $fetch('/api/equipment', {
        method: 'POST',

        body: {
          equipmentId: item.id
        }
      })

      options.value = options.value.filter(({ id }) => id !== item.id)

      await updateEquipment()
    } catch (error) {
      console.error(error)
    }
  }

  async function removeItem(item: EquipmentItem) {
    try {
      await $fetch(`/api/user/equipment/${item.id}`, {
        method: 'DELETE'
      })

      await updateEquipment()
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
