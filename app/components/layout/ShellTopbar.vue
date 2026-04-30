<template>
  <header :class="$style.component" data-testid="shell-topbar">
    <NuxtLink to="/" :class="$style.brand">
      perd<em :class="$style.brandPunctuation">.</em>
    </NuxtLink>

    <span :class="$style.path">
      / {{ currentSectionLabel }}
    </span>

    <div :class="$style.spacer" />

    <NuxtLink
      to="/account"
      :class="$style.action"
      aria-label="Open account"
    >
      <Icon name="tabler:user" />
    </NuxtLink>

    <button
      type="button"
      :class="$style.action"
      aria-label="Log out"
      @click="emitLogout"
    >
      <Icon name="tabler:logout-2" />
    </button>
  </header>
</template>

<script lang="ts" setup>
  interface Props {
    currentSectionLabel: string;
  }

  type Emits = (event: 'logout') => void

  defineProps<Props>()
  const emit = defineEmits<Emits>()

  function emitLogout() {
    emit('logout')
  }
</script>

<style module>
  .component {
    position: sticky;
    inset-block-start: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12) var(--spacing-16);
    border-block-end: 1px solid var(--color-border-subtle);
    background: color-mix(in oklch, var(--color-background-raised), transparent 9%);
    backdrop-filter: blur(14px) saturate(1.3);

    @media (width >= 900px) {
      display: none;
    }
  }

  .brand {
    color: inherit;
    text-decoration: none;
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0;
    outline: 2px solid transparent;
    outline-offset: 3px;

    &:focus-visible {
      outline-color: var(--color-accent-ring);
    }
  }

  .brandPunctuation {
    color: var(--color-accent-base);
    font-style: normal;
  }

  .path {
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .spacer {
    flex: 1;
  }

  .action {
    display: grid;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    border-radius: var(--border-radius-12);
    color: var(--color-text-secondary);
    text-decoration: none;
    background: transparent;
    border: 1px solid transparent;
    outline: 2px solid transparent;
    outline-offset: 3px;
    transition:
      background-color var(--transition-duration-base) var(--transition-easing-out),
      border-color var(--transition-duration-base) var(--transition-easing-out),
      color var(--transition-duration-base) var(--transition-easing-out);

    &:focus-visible,
    &:hover {
      background: var(--color-surface-base);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      outline-color: var(--color-accent-ring);
    }
  }
</style>
