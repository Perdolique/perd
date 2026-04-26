<template>
  <nav :class="$style.navigationGroup" aria-label="Workspace navigation">
    <p :class="$style.navigationTitle">
      Workspace
    </p>

    <NuxtLink
      to="/"
      exact-active-class="active"
      :class="$style.navigationItem"
    >
      <Icon name="tabler:home-2" :class="$style.navigationIcon" />
      <span>Dashboard</span>
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
  </nav>
</template>

<style module>
  .navigationGroup {
    display: grid;
    gap: var(--spacing-4);
  }

  .navigationTitle {
    margin: 0;
    padding: var(--spacing-12) var(--spacing-12) var(--spacing-4);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: 0;
    color: var(--color-text-muted);
    text-transform: none;
  }

  .navigationItem {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    min-height: 2.875rem;
    padding: 0 var(--spacing-12);
    border-radius: var(--border-radius-12);
    color: var(--color-text-secondary);
    background: transparent;
    text-decoration: none;
    border: 1px solid transparent;
    outline: none;
    transition:
      background-color var(--transition-duration-base) var(--transition-easing-out),
      border-color var(--transition-duration-base) var(--transition-easing-out),
      color var(--transition-duration-base) var(--transition-easing-out),
      transform var(--transition-duration-quick) var(--transition-easing-out);

    &:focus-visible,
    &:hover {
      background: var(--color-surface-base);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
    }

    &:global(.active) {
      background: var(--color-surface-base);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
      box-shadow: inset 3px 0 0 var(--color-accent-base);
    }
  }

  .navigationIcon {
    font-size: 1rem;
    flex-shrink: 0;
  }
</style>
