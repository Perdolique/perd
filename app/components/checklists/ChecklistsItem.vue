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

  const props = defineProps<Props>()
  const path = computed(() => `/checklists/${props.checklistId}`)
</script>

<style lang="scss" module>
  .component {
    display: flex;
    align-items: center;
    height: 60px;
    background-color: var(--element-color-background);
    padding: 0 var(--spacing-16);
    border: 1px solid var(--input-color-main);
    border-radius: var(--border-radius-16);
    font-size: var(--font-size-20);
    color: var(--input-color-main);
    user-select: none;
    cursor: pointer;
    outline: none;
    text-decoration: none;
    transition:
      background-color 0.2s,
      border-color 0.2s,
      color 0.2s;

    &:hover,
    &:focus {
      background-color: var(--input-color-focus);
      color: var(--button-color-text);
      border-color: var(--input-color-focus);
    }

    &:active {
      background-color: var(--input-color-active);
    }
  }

  .name {
    @include overflow-ellipsis();
  }
</style>
