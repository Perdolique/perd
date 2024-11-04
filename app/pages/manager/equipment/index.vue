<template>
  <PageContent page-title="Equipment manager">
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
      <PerdPaginator
        :limit="data.meta.limit"
        :offset="data.meta.offset"
        :total="data.meta.total"
        :class="$style.paginator"
        @page-change="handlePageChange"
      />

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
  import EmptyState from '~/components/EmptyState.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdMenu from '~/components/PerdMenu.vue'
  import OptionButton from '~/components/PerdMenu/OptionButton.vue'
  import PerdPaginator from '~/components/PerdPaginator.vue'
  import EquipmentTable from '~/components/manager/equipment/EquipmentTable.vue'
  import EquipmentCards from '~/components/manager/equipment/EquipmentCards.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const router = useRouter()
  const page = ref(1)

  const { data, error } = await useFetch('/api/equipment/drafts', {
    query: {
      page
    },

    transform: ({ data, meta }) => {
      const equipment = data.map((item) => {
        const idString = item.id.toString();

        return {
          id: idString,
          key: idString,
          name: item.name
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
  }
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

  .paginator {
    justify-self: end;
  }
</style>
