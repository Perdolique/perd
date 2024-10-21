<template>
  <table :class="$style.component">
    <thead :class="$style.header">
      <HeaderRow :columns="columns" />
    </thead>

    <tbody>
      <tr
        :class="$style.row"
        v-for="row in data"
        :key="row.key"
      >
        <td
          v-for="column in columns"
          :key="column.key"
          :class="$style.cell"
        >
          <slot
            :name="column.key"
            :row-data="row"
          />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts">
  interface RowBase {
    readonly key: string;
  }
</script>

<script lang="ts" setup generic="RowType extends RowBase">
  import HeaderRow, { type Column } from './HeaderRow.vue';

  interface Props {
    readonly data: RowType[];
    readonly columns: Column[];
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border-radius: var(--border-radius-12);
    overflow: hidden;
  }

  .header {
    font-size: var(--font-size-14);
    height: var(--table-row-height);
    background-color: var(--accent-600);
    color: var(--text-100);
    text-transform: uppercase;
    text-align: left;
  }

  .row {
    height: var(--table-row-height);
    background-color: var(--accent-50);

    &:nth-child(even) {
      background-color: var(--accent-100);
    }
  }

  .cell {
    padding: var(--table-cell-padding);
  }
</style>
