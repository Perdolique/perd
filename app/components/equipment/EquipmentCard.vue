<template>
  <div :class="$style.component">
    <div :class="$style.name">
      {{ name }}
    </div>

    <div :class="$style.id">
      {{ formattedWeight }}
    </div>

    <EquipmentStatusTag
      :class="$style.status"
      :status="status"
    />
  </div>
</template>

<script lang="ts" setup>
  import EquipmentStatusTag from './EquipmentStatusTag.vue';

  interface Props {
    readonly id: string;
    readonly name: string;
    readonly status: string;
    readonly weight: number;
  }

  const { weight } = defineProps<Props>()
  const formattedWeight = computed(() => formatWeight(weight));
</script>

<style module>
  .component {
    display: grid;
    justify-content: space-between;
    row-gap: var(--spacing-8);
    background-color: var(--accent-50);
    border: 1px solid var(--accent-200);
    border-radius: var(--border-radius-8);
    padding: var(--spacing-16);
  }

  .name {
    grid-area: 1 / 1 / 2 / 2;
    font-weight: var(--font-weight-medium);
  }

  .id {
    grid-area: 2 / 1 / 3 / 2;
    font-size: var(--font-size-12);
    color: var(--text-400);
  }

  .status {
    grid-area: 1 / 2 / 3 / 3;
    align-self: start;
  }
</style>
