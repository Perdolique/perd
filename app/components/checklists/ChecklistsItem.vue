<template>
  <NuxtLink
    :to="path"
    :class="$style.component"
  >
    <span :class="$style.name">
      {{ checklistName }}
    </span>
  </NuxtLink>
</template>

<script lang="ts" setup>
  interface Props {
    readonly checklistId: string;
    readonly checklistName: string;
  }

  const { checklistId } = defineProps<Props>()
  const path = computed(() => `/checklists/${checklistId}`)
</script>

<style lang="scss" module>
  .component {
    display: flex;
    align-items: center;
    height: 60px;
    background-color: var(--secondary-100);
    padding: 0 var(--spacing-16);
    border: 1px solid var(--secondary-200);
    border-radius: var(--border-radius-16);
    font-size: var(--font-size-20);
    color: var(--text);
    user-select: none;
    cursor: pointer;
    outline: none;
    text-decoration: none;
    transition:
      background-color var(--transition-time-quick),
      border-color var(--transition-time-quick),
      color var(--transition-time-quick);

    &:hover,
    &:focus-visible {
      background-color: var(--secondary-200);
      border-color: var(--secondary-300);
    }

    &:active {
      background-color: var(--secondary-300);
    }
  }

  .name {
    @include overflow-ellipsis();
  }
</style>
