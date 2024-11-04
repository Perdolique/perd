<template>
  <PerdTable
    :data="items"
    :columns="columns"
    :class="$style.table"
  >
    <template #name="{ rowData }">
      <span :class="$style.nameCell">
        {{ rowData.name }}
      </span>
    </template>

    <template #weight="{ rowData }">
      {{ formatWeight(rowData.weight) }}
    </template>

    <template #status="{ rowData }">
      <EquipmentStatusTag :status="rowData.status" />
    </template>
  </PerdTable>
</template>

<script lang="ts" setup>
  import PerdTable from '@/components/PerdTable/PerdTable.vue';
  import EquipmentStatusTag from './EquipmentStatusTag.vue';

  interface Item {
    readonly id: string;
    readonly key: string;
    readonly name: string;
    readonly status: string;
    readonly weight: number;
  }

  interface Props {
    readonly items: Item[];
  }

  defineProps<Props>();

  const columns = [
    { key: 'name',   label: 'Name' },
    { key: 'weight', label: 'Weight' },
    { key: 'status', label: 'Status' }
  ]
</script>

<style lang="scss" module>
  .table {
    display: none;

    @include mobileLarge {
      display: table;
    }
  }

  .nameCell {
    font-weight: var(--font-weight-medium);
  }
</style>
