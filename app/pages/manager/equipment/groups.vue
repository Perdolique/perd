<template>
  <PageContent page-title="Equipment groups">
    <template #actions>
      <PerdButton
        icon="tabler:plus"
        small
        @click="onAddClick"
      >
        Add group
      </PerdButton>
    </template>

    <EmptyState
      v-if="hasGroupsError"
      icon="streamline-emojis:face-screaming-in-fear"
    >
      Can't load equipment groups
    </EmptyState>

    <EmptyState
      v-else-if="isEmpty"
      icon="tabler:category"
    >
      No groups added
    </EmptyState>

    <div
      v-else
      :class="$style.list"
    >
      <div
        v-for="group in groups"
        :key="group.id"
        :class="$style.item"
      >
        {{ group.name }}
      </div>
    </div>

    <InputDialog
      v-model="isAddDialogOpen"
      header-text="Add equipment group"
      placeholder="Essentials"
      add-button-text="Add group"
      :maxlength="limits.maxEquipmentGroupNameLength"
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
  const { groups, addGroup, fetchGroups, hasError: hasGroupsError } = useEquipmentGroupsState()
  const isEmpty = computed(() => groups.value.length === 0)

  await fetchGroups()

  function onAddClick() {
    isAddDialogOpen.value = true
  }

  async function onAddDialogSubmit(groupName: string) {
    try {
      const newGroup = await $fetch('/api/equipment/groups', {
        method: 'POST',

        body: {
          name: groupName
        }
      })

      addGroup(newGroup)

      addToast({
        title: 'Equipment group added',
        message: `Group "${groupName}" has been added`
      })
    } catch (error) {
      const message = getFetchErrorMessage(error)

      addToast({
        title: 'Failed to add equipment group',
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
