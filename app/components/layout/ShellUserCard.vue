<template>
  <NuxtLink
    to="/account"
    active-class="active"
    :class="$style.component"
    aria-label="Account"
  >
    <UserAvatar :initial="userInitial" />

    <strong :class="$style.name">{{ userLabel }}</strong>
  </NuxtLink>
</template>

<script lang="ts" setup>
  import UserAvatar from '~/components/UserAvatar.vue'

  interface Props {
    userInitial: string;
    userLabel: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-20);
    background: var(--color-surface-primary);
    border: 1px solid var(--color-border-subtle);
    text-decoration: none;
    color: inherit;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      border-color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover,
    &:focus-visible {
      background: var(--color-surface-secondary);
      border-color: var(--color-border-strong);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      box-shadow: inset 3px 0 0 var(--color-accent-primary);
    }
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--font-size-14);
    color: var(--color-text-primary);
  }
</style>
