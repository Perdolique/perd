<template>
  <NuxtLink
    to="/"
    :class="$style.component"
    aria-label="Perd"
  >
    <span :class="$style.logoLockup" aria-hidden="true">
      <span :class="$style.icon" />
      <span :class="$style.logo" />
    </span>
  </NuxtLink>
</template>

<style module>
  .component {
    display: inline-flex;
    align-items: center;
    color: var(--color-accent-primary);
    text-decoration: none;
    transition:
      color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover {
      color: var(--color-accent-hover);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }
  }

  .logoLockup {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-12);
  }

  .icon {
    inline-size: 2.5rem;
    aspect-ratio: 1;
    flex-shrink: 0;
    background: currentColor;
    mask: url("/images/logo.svg") center / contain no-repeat;
  }

  .logo {
    inline-size: 7.5rem;
    aspect-ratio: 1563 / 295;
    flex-shrink: 0;
    background: currentColor;
    mask: url("/images/metsik-app.svg") center / contain no-repeat;
  }
</style>
