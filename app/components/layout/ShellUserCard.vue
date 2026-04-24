<template>
  <NuxtLink
    to="/account"
    active-class="active"
    :class="$style.component"
    aria-label="Account"
  >
    <UserAvatar :initial="userInitial" />

    <div :class="$style.meta">
      <strong :class="$style.name">{{ userLabel }}</strong>
      <span :class="$style.role">{{ userRole }}</span>
    </div>
  </NuxtLink>
</template>

<script lang="ts" setup>
  import UserAvatar from '~/components/UserAvatar.vue'

  interface Props {
    userInitial: string;
    userLabel: string;
    userRole: string;
  }

  defineProps<Props>()
</script>

<style module>
  .component {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-16);
    background: color-mix(in oklch, var(--color-surface-base), transparent 18%);
    border: 1px solid var(--color-border-subtle);
    text-decoration: none;
    color: inherit;
    outline: none;
    transition:
      background-color var(--transition-duration-base) var(--transition-easing-out),
      border-color var(--transition-duration-base) var(--transition-easing-out),
      box-shadow var(--transition-duration-base) var(--transition-easing-out);

    &:focus-visible,
    &:hover {
      background: var(--color-surface-base);
      border-color: var(--color-border-subtle);
    }

    &:global(.active) {
      box-shadow: inset 3px 0 0 var(--color-accent-base);
    }
  }

  .meta {
    min-width: 0;
    display: grid;
    gap: 0.15rem;
  }

  .name,
  .role {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name {
    font-size: var(--font-size-14);
    color: var(--color-text-primary);
  }

  .role {
    font-size: var(--font-size-12);
    color: var(--color-text-muted);
  }
</style>
