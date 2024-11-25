<template>
  <div :class="$style.component">
    <BrandCard
      v-for="brand in brands"
      :id="brand.id"
      :key="brand.id"
      :name="brand.name"
      :website-url="brand.websiteUrl"
      :equipment-count="brand.equipmentCount"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { BrandModel } from '~/models/brand';
  import BrandCard from './BrandCard.vue';

  interface Props {
    readonly brands: BrandModel[];
  }

  defineProps<Props>();
</script>

<style lang="scss" module>
  .component {
    display: grid;
    row-gap: var(--spacing-8);
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-8);

    @include mobileLarge {
      display: none;
    }
  }
</style>
