<template>
  <div :class="$style.component">
    <Icon
      :name="icon"
      size="1.5em"
    />

    <slot />
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    readonly icon: string;
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: var(--spacing-8);
    padding: var(--spacing-32);
    color: var(--text-700);
    background-color: var(--accent-50);
    border: 1px solid var(--accent-200);
    border-radius: var(--border-radius-16);
  }
</style>
