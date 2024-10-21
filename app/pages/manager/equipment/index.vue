<template>
  <PageContent page-title="Equipment management">
    <template #actions>
      <div :class="$style.actions">
        <PerdButton
          small
          icon="tabler:plus"
          @click="handleAddItemClick"
        >
          Add item
        </PerdButton>

        <PerdMenu
          icon="tabler:link"
          text="Manage"
        >
          <OptionButton
            icon="tabler:filters"
            @click="handleTypesClick"
          >
            Types
          </OptionButton>

          <OptionButton
            icon="tabler:category"
            @click="handleGroupsClick"
          >
            Groups
          </OptionButton>
        </PerdMenu>
      </div>
    </template>

    <EmptyState
      v-if="error"
      icon="streamline-emojis:face-screaming-in-fear"
    >
      Can't load equipment data
    </EmptyState>

    <div
      :class="$style.content"
      v-else-if="data"
    >
      <div :class="$style.filtersContainer">
        <EquipmentFilters
          v-model:search="searchValue"
          v-model:status="equipmentStatus"
          :loading="isFiltering"
          @submit="applyFilters"
        />

        <PerdPaginator
          :limit="data.meta.limit"
          :offset="data.meta.offset"
          :total="data.meta.total"
          :class="$style.paginator"
          @page-change="handlePageChange"
        />
      </div>

      <EmptyState
        v-if="noResults"
        icon="streamline-emojis:man-shrugging-2"
      >
        No results found
      </EmptyState>

      <template v-else>
        <EquipmentTable :items="data.equipment" />
        <EquipmentCards :items="data.equipment" />
      </template>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import type { EquipmentStatus } from '~~/server/models'
  import EmptyState from '~/components/EmptyState.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdMenu from '~/components/PerdMenu.vue'
  import OptionButton from '~/components/PerdMenu/OptionButton.vue'
  import PerdPaginator from '~/components/PerdPaginator.vue'
  import EquipmentTable from '~/components/equipment/EquipmentTable.vue'
  import EquipmentCards from '~/components/equipment/EquipmentCards.vue'
  import EquipmentFilters from '~/components/equipment/EquipmentFilters.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const router = useRouter()
  const isFiltering = ref(false)
  const page = ref(1)
  const searchValue = ref('')
  const equipmentStatus = ref<EquipmentStatus | ''>('')
  const searchQuery = computed(() => searchValue.value === '' ? undefined : searchValue.value)
  const equipmentStatusQuery = computed(() => equipmentStatus.value === '' ? undefined : equipmentStatus.value)

  const { data, error, status, refresh } = await useFetch('/api/equipment', {
    watch: false,

    query: {
      page,
      search: searchQuery,
      status: equipmentStatusQuery
    },

    transform: ({ data, meta }) => {
      const equipment = data.map((item) => {
        const idString = item.id.toString();

        return {
          id: idString,
          key: idString,
          name: item.name,
          status: item.status,
          weight: item.weight
        }
      })

      return {
        equipment,
        meta
      }
    }
  })

  const noResults = computed(() => data.value?.equipment.length === 0)

  function handleAddItemClick() {
    router.push('/manager/equipment/add')
  }

  function handleTypesClick() {
    router.push('/manager/equipment/types')
  }

  function handleGroupsClick() {
    router.push('/manager/equipment/groups')
  }

  function handlePageChange(newPage: number) {
    page.value = newPage

    refresh()
  }

  function applyFilters() {
    page.value = 1
    isFiltering.value = true

    refresh()
  }

  watch(status, () => {
    if (status.value !== 'pending') {
      isFiltering.value = false
    }
  })
</script>

<style module>
  .actions {
    display: flex;
    column-gap: var(--spacing-8);
  }

  .content {
    display: grid;
    row-gap: var(--spacing-12);
  }

  .filtersContainer {
    display: grid;
    align-items: center;
    row-gap: var(--spacing-24);
  }

  .paginator {
    justify-self: end;
  }
</style>
