<template>
  <PerdTable
    :data="brands"
    :columns="columns"
    :class="$style.table"
    key-field="id"
  >
    <template #name="{ rowData }">
      <PerdLink :to="`/brands/details/${rowData.id}`">
        {{ rowData.name }}
      </PerdLink>
    </template>

    <template #info="{ rowData }">
      <BrandInfo
        :equipment-count="rowData.equipmentCount"
        :website-url="rowData.websiteUrl"
      />
    </template>
  </PerdTable>
</template>

<script lang="ts" setup>
  import type { BrandModel } from '~/models/brand';
  import PerdTable from '@/components/PerdTable/PerdTable.vue';
  import PerdLink from '@/components/PerdLink.vue';
  import BrandInfo from './BrandInfo.vue';

  interface Props {
    readonly brands: BrandModel[];
  }

  defineProps<Props>();

  const classNames = useCssModule();

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'info', label: '', headerClass: classNames.infoHeader },
  ]
</script>

<style lang="scss" module>
  .table {
    display: none;

    @include mobileLarge {
      display: table;
    }
  }

  .infoHeader {
    width: 180px;
  }
</style>
