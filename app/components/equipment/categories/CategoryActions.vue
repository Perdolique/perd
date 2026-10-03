<template>
  <PerdActionMenu :label="triggerLabel" :menu-label="menuLabel" :items="items" @action="handleAction" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import PerdActionMenu, { type ActionMenuItem } from '~/components/PerdActionMenu.vue'

  interface Props {
    categoryName: string;
    propertiesPath: string;
  }

  interface Emits {
    edit: [];
    delete: [];
  }

  const { categoryName, propertiesPath } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const triggerLabel = computed(() => `Actions for ${categoryName}`)
  const menuLabel = computed(() => `${categoryName} actions`)

  const items = computed<ActionMenuItem[]>(() => [
    {
      id: 'characteristics',
      label: 'Characteristics',
      icon: 'hugeicons:sliders-horizontal',
      to: propertiesPath
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: 'hugeicons:pencil-edit-02'
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'hugeicons:delete-02',
      danger: true,
      separator: true
    }
  ])

  function handleAction(id: string) {
    if (id === 'edit') {
      emit('edit')
    } else if (id === 'delete') {
      emit('delete')
    }
  }
</script>
