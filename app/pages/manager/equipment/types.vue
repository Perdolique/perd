<template>
  <PageContent page-title="Equipment types">
    <template #actions>
      <PerdButton
        icon="tabler:plus"
        @click="onAddClick"
      >
        Add type
      </PerdButton>
    </template>

    <EmptyState
      v-if="hasTypesError"
      icon="streamline-emojis:face-screaming-in-fear"
    >
      Can't load equipment types
    </EmptyState>

    <EmptyState
      v-else-if="isEmpty"
      icon="tabler:filters"
    >
      No types added
    </EmptyState>

    <div
      v-else
      :class="$style.list"
    >
      <div
        v-for="type in types"
        :key="type.id"
        :class="$style.item"
      >
        {{ type.name }}
      </div>
    </div>

    <InputDialog
      v-model="isAddDialogOpen"
      header-text="Add equipment type"
      placeholder="Sleeping bag"
      add-button-text="Add type"
      :maxlength="limits.maxEquipmentTypeNameLength"
      @submit="onAddDialogSubmit"
    />
  </PageContent>
</template>

<script lang="ts" setup>
  import { limits } from '~~/constants';
  import PageContent from '~/components/layout/PageContent.vue';
  import PerdButton from '~/components/PerdButton.vue';
  import EmptyState from '~/components/EmptyState.vue';
  import InputDialog from '~/components/dialogs/InputDialog.vue';

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const isAddDialogOpen = ref(false)
  const { addToast } = useToaster()
  const { types, addType, fetchTypes, hasError: hasTypesError } = useEquipmentTypesState()
  const isEmpty = computed(() => types.value.length === 0)

  await fetchTypes()

  function onAddClick() {
    isAddDialogOpen.value = true
  }

  async function onAddDialogSubmit(typeName: string) {
    try {
      const newType = await $fetch('/api/equipment/types', {
        method: 'POST',

        body: {
          name: typeName
        }
      })

      addType(newType)

      addToast({
        title: 'Equipment type added',
        message: `Type "${typeName}" has been added`
      })
    } catch (error) {
      const message = getFetchErrorMessage(error)

      addToast({
        title: 'Failed to add equipment type',
        message
      })
    }
  }
</script>

<style module>
  .list {
    display: grid;
    row-gap: var(--spacing-12);
  }

  .item {
    height: 48px;
    align-content: center;
    padding: 0 var(--spacing-16);
    background-color: var(--accent-100);
    border: 1px solid var(--accent-200);
    border-radius: var(--border-radius-16);
  }
</style>
