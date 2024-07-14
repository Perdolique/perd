<template>
  <div
    :class="$style.component"
    :key="id"
  >
    <div :class="[$style.cell, 'id']">
      {{ id }}
    </div>

    <div :class="[$style.cell, 'name']">
      {{ name }}
    </div>

    <div :class="[$style.cell, 'weight']">
      {{ formattedWeight }}
    </div>

    <div :class="[$style.cell, 'created']">
      {{ formattedDate }}
    </div>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    readonly id: string;
    readonly name: string;
    readonly weight: number | null;
    readonly createdAt: string;
  }

  const props = defineProps<Props>()
  const formattedDate = computed(() => formatDate(props.createdAt, 'yyyy-MM-dd, HH:mm'))
  const formattedWeight = computed(() => props.weight ?? 'N/A')
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: 1fr 2fr 1fr 1fr;
  }

  .cell {
    padding: var(--spacing-8);
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
