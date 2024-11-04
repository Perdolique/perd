<template>
  <div :class="$style.component">
    <EquipmentCard
      v-for="item in items"
      :id="item.id"
      :key="item.id"
      :name="item.name"
    />
  </div>
</template>

<script lang="ts" setup>
  import EquipmentCard from './EquipmentCard.vue';

  interface Item {
    readonly id: string;
    readonly name: string;
  }

  interface Props {
    readonly items: Item[];
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
