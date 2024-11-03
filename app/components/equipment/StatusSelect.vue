<template>
  <PerdSelect
    placeholder="Status"
    :model-value="model"
    :options="options"
    :disabled="loading"
    @update:model-value="onChange"
  />
</template>

<script lang="ts" setup>
  import type { EquipmentStatus } from '~~/server/models';
  import PerdSelect from '@/components/PerdSelect.vue'

  interface Props {
    readonly loading?: boolean;
  }

  defineProps<Props>()

  const options = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' }
  ]

  const model = defineModel({
    required: true,
    default: '' satisfies EquipmentStatus | ''
  })

  function onChange(value: string) {
    model.value = value
  }
</script>
