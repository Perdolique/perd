<template>
  <span :class="$style.component">
    <Icon
      :name="icon"
      size="1.25em"
    />

    <slot />
  </span>
</template>

<script lang="ts" setup>
  interface Props {
    readonly icon: string;
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    font-size: var(--font-size-14);
    display: flex;
    align-items: center;
    column-gap: var(--spacing-4);
    color: var(--text-500);
  }
</style>
