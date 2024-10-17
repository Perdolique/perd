<template>
  <NuxtLink :class="$style.component"
    :to="to"
    active-class="active"
  >
    <Icon
      size="1.125em"
      :name="icon"
    />

    <div :class="$style.text">
      <slot />
    </div>
  </NuxtLink>
</template>

<script lang="ts" setup>
  interface Props {
    readonly to: string;
    readonly icon: string;
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    height: 50px;
    display: grid;
    align-items: center;
    grid-template-columns: auto 1fr;
    column-gap: var(--spacing-8);
    padding: 0 var(--spacing-16);
    color: var(--text);
    text-decoration: none;
    outline: none;
    container-type: inline-size;
    background-color: transparent;
    transition:
      column-gap var(--transition-time-quick) ease-out,
      background-color var(--transition-time-quick) ease-out;

    &:focus-visible,
    &:hover {
      background-color: var(--background-300);
    }

    &:global(.active) {
      background-color: var(--background-400);
      cursor: default;
    }
  }

  .text {
    opacity: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition:
      opacity var(--transition-time-quick),
      display var(--transition-time-quick) allow-discrete;

    @container (max-width: 60px) {
      opacity: 0;
      display: none;
    }
  }
</style>
