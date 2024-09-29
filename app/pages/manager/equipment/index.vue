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
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue';
  import PerdMenu from '~/components/PerdMenu.vue'
  import OptionButton from '~/components/PerdMenu/OptionButton.vue'

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const router = useRouter()

  function handleAddItemClick() {
    router.push('/manager/equipment/add')
  }

  function handleTypesClick() {
    router.push('/manager/equipment/types')
  }

  function handleGroupsClick() {
    router.push('/manager/equipment/groups')
  }
</script>

<style module>
  .actions {
    display: flex;
    column-gap: var(--spacing-8);
  }
</style>
