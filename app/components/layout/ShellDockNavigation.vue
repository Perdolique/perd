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
      <span>Home</span>
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
      to="/packs"
      active-class="active"
      :class="$style.dockItem"
    >
      <span :class="$style.dockIcon">
        <Icon name="tabler:route" />
      </span>
      <span>Packs</span>
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
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    padding: var(--spacing-8) var(--spacing-8) calc(var(--spacing-8) + var(--layout-safe-bottom));
    border-block-start: 1px solid var(--color-border-subtle);
    background: color-mix(in oklch, var(--color-background-elevated), transparent 6%);
    backdrop-filter: blur(14px) saturate(1.25);

    @media (width >= 900px) {
      display: none;
    }
  }

  .dockItem {
    display: grid;
    justify-items: center;
    gap: var(--spacing-4);
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-4);
    border-radius: var(--border-radius-14);
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      color: var(--color-text-primary);

      & .dockIcon {
        background: var(--color-accent-primary);
        color: var(--color-accent-contrast);
        border-color: transparent;
      }
    }
  }

  .dockIcon {
    display: grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 1.75rem;
    border-radius: var(--border-radius-pill);
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-primary);
    color: inherit;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      color var(--transition-duration-normal) var(--transition-easing-standard),
      border-color var(--transition-duration-normal) var(--transition-easing-standard);
  }
</style>
