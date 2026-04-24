<template>
  <nav
    :class="$style.dock"
    data-testid="shell-dock"
    aria-label="Primary navigation"
  >
    <NuxtLink
      to="/"
      exact-active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon">
        <Icon name="tabler:home-2" />
      </span>
      <span>Dashboard</span>
    </NuxtLink>

    <NuxtLink
      to="/catalog"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon">
        <Icon name="tabler:package" />
      </span>
      <span>Catalog</span>
    </NuxtLink>

    <NuxtLink
      to="/inventory"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon">
        <Icon name="tabler:backpack" />
      </span>
      <span>Gear</span>
    </NuxtLink>

    <NuxtLink
      to="/account"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon">
        <Icon name="tabler:user" />
      </span>
      <span>Account</span>
    </NuxtLink>
  </nav>
</template>

<style module>
  .dock {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 0.375rem 0.5rem calc(0.5rem + env(safe-area-inset-bottom));
    border-top: 1px solid var(--color-border-subtle);
    background: color-mix(in oklch, var(--color-background-raised), transparent 6%);
    backdrop-filter: blur(14px) saturate(1.25);

    @media (width >= 900px) {
      display: none;
    }
  }

  .dockItem {
    display: grid;
    justify-items: center;
    gap: 0.15rem;
    padding: 0.45rem 0.25rem;
    border-radius: var(--border-radius-12);
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    outline: none;

    &:global(.active) {
      color: var(--color-text-primary);
    }

    &:global(.active) .dockIcon {
      background: var(--color-accent-base);
      color: var(--color-accent-contrast);
      border-color: transparent;
    }
  }

  .dockIcon {
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 1.9rem;
    border-radius: 999px;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-base);
    color: inherit;
    transition:
      background-color var(--transition-duration-base) var(--transition-easing-out),
      color var(--transition-duration-base) var(--transition-easing-out),
      border-color var(--transition-duration-base) var(--transition-easing-out);
  }
</style>
