<template>
  <nav :class="$style.navigationGroup" aria-label="Workspace navigation">
    <NuxtLink
      to="/"
      exact-active-class="active"
      :class="$style.navigationItem"
    >
      <Icon name="tabler:home-2" :class="$style.navigationIcon" />
      <span>Home</span>
    </NuxtLink>

    <NuxtLink
      to="/catalog"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon name="tabler:package" :class="$style.navigationIcon" />
      <span>Catalog</span>
    </NuxtLink>

    <NuxtLink
      to="/inventory"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon name="tabler:backpack" :class="$style.navigationIcon" />
      <span>Gear</span>
    </NuxtLink>

    <NuxtLink
      to="/packs"
      active-class="active"
      :class="$style.navigationItem"
    >
      <Icon name="tabler:route" :class="$style.navigationIcon" />
      <span>Packs</span>
    </NuxtLink>
  </nav>
</template>

<style module>
  .navigationGroup {
    display: grid;
    gap: var(--spacing-8);
  }

  .navigationItem {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    min-height: var(--layout-touch-target);
    padding: 0 var(--spacing-12);
    border-radius: var(--border-radius-14);
    color: var(--color-text-secondary);
    background: transparent;
    text-decoration: none;
    border: 1px solid transparent;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      border-color var(--transition-duration-normal) var(--transition-easing-standard),
      color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover,
    &:focus-visible {
      background: var(--color-surface-primary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      background: var(--color-surface-primary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
      box-shadow: inset 3px 0 0 var(--color-accent-primary);
    }
  }

  .navigationIcon {
    font-size: 1rem;
    flex-shrink: 0;
  }
</style>
