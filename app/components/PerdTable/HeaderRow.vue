<template>
  <tr>
    <th
      :class="$style.cell"
      v-for="column in columns"
      :key="column.key"
    >
      {{ column.label }}
    </th>
  </tr>
</template>

<script lang="ts" setup>
  export interface Column {
    readonly key: string;
    readonly label?: string;
  }

  interface Props {
    readonly columns: Column[];
  }

  defineProps<Props>();
</script>

<style module>
  .cell {
    font-weight: var(--font-weight-medium);
    padding: var(--table-cell-padding);
  }
</style>
