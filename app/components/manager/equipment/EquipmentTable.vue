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
  </PerdTable>
</template>

<script lang="ts" setup>
  import PerdTable from '@/components/PerdTable/PerdTable.vue';

  interface Item {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  }

  interface Props {
    readonly items: Item[];
  }

  defineProps<Props>();

  const columns = [
    { key: 'name', label: 'Name' }
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
