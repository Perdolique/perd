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
      <span :class="$style.dockIcon" aria-hidden="true">
        <Icon name="tabler:home-2" />
      </span>
      <span>Home</span>
    </NuxtLink>

    <NuxtLink
      to="/packs"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon" aria-hidden="true">
        <Icon name="tabler:route" />
      </span>
      <span>Routes</span>
    </NuxtLink>

    <NuxtLink
      to="/inventory"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon" aria-hidden="true">
        <Icon name="tabler:backpack" />
      </span>
      <span>Gear</span>
    </NuxtLink>

    <NuxtLink
      to="/account"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon" aria-hidden="true">
        <Icon name="tabler:user" />
      </span>
      <span>Profile</span>
    </NuxtLink>
  </nav>
</template>

<style module>
  .dock {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: var(--z-index-shell-dock);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    min-block-size: calc(var(--layout-dock-height) + var(--layout-safe-bottom));
    padding: var(--spacing-12) var(--spacing-16) calc(var(--spacing-12) + var(--layout-safe-bottom));
    border-block-start: 1px solid var(--color-border-subtle);
    background: var(--color-background-elevated);

    @media (width >= 900px) {
      display: none;
    }
  }

  .dockItem {
    display: grid;
    grid-template-rows: 2.25rem auto;
    justify-items: center;
    align-items: center;
    gap: var(--spacing-4);
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-4);
    border-radius: var(--border-radius-10);
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-tight);
    transition: color var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover {
      color: var(--color-text-secondary);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      color: var(--color-accent-primary);
      font-weight: var(--font-weight-semibold);
    }
  }

  .dockIcon {
    display: grid;
    font-size: 1.75rem;
  }
</style>
