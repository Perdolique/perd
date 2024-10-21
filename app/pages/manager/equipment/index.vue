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
      <PerdPaginator
        :limit="data.meta.limit"
        :offset="data.meta.offset"
        :total="data.meta.total"
        :class="$style.paginator"
        @page-change="handlePageChange"
      />

      <PerdTable
        :data="data.equipment"
        :columns="columns"
      >
        <template #name="{ rowData }">
          <span :class="$style.nameCell">
            {{ rowData.name }}
          </span>
        </template>

        <template #status="{ rowData }">
          <EquipmentStatusCell :status="rowData.status" />
        </template>
      </PerdTable>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import EmptyState from '~/components/EmptyState.vue';
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue';
  import PerdMenu from '~/components/PerdMenu.vue'
  import OptionButton from '~/components/PerdMenu/OptionButton.vue'
  import PerdTable from '~/components/PerdTable/PerdTable.vue';
  import EquipmentStatusCell from '~/components/equipment/EquipmentStatusCell.vue';
  import PerdPaginator from '~/components/PerdPaginator.vue';

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const columns = [
    { key: 'name',   label: 'Name' },
    { key: 'status', label: 'Status' }
  ]

  const router = useRouter()
  const page = ref(1)

  const { data, error } = await useFetch('/api/equipment', {
    query: { page },

    transform: ({ data, meta }) => {
      const equipment = data.map((item) => {
        const idString = item.id.toString();

        return {
          id: idString,
          key: idString,
          name: item.name,
          status: item.status
        }
      })

      return {
        equipment,
        meta
      }
    }
  })

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

  .nameCell {
    font-weight: var(--font-weight-medium);
  }
</style>
