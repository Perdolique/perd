<template>
  <div :class="$style.layout">
    <aside :class="$style.sidebar" data-testid="shell-sidebar">
      <NuxtLink to="/" :class="$style.brand">
        <span :class="$style.brandMark">
          perd<em :class="$style.brandPunctuation">.</em>
        </span>
      </NuxtLink>

      <ShellSidebarNavigation />

      <div :class="$style.sidebarFoot">
        <ShellUserCard
          :user-initial="userInitial"
          :user-label="userLabel"
        />

        <button
          type="button"
          :class="$style.logoutButton"
          @click="removeAuthSession"
        >
          <Icon name="tabler:logout-2" :class="$style.navigationIcon" />
          <span>Log out</span>
        </button>
      </div>
    </aside>

    <div :class="$style.main">
      <header
        :class="$style.mobileHeader"
        data-testid="shell-mobile-header"
      >
        <NuxtLink
          to="/"
          :class="$style.mobileBrand"
          aria-label="Home"
        >
          <span :class="$style.mobileLogo" aria-hidden="true" />
        </NuxtLink>
      </header>

      <div :class="$style.content">
        <slot />
      </div>
    </div>

    <ShellDockNavigation />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { $fetch } from 'ofetch'
  import { navigateTo, useUserStore } from '#imports'
  import ShellDockNavigation from '~/components/layout/ShellDockNavigation.vue'
  import ShellSidebarNavigation from '~/components/layout/ShellSidebarNavigation.vue'
  import ShellUserCard from '~/components/layout/ShellUserCard.vue'

  const { resetAuthentication, user } = useUserStore()

  const userIdText = computed(() => user.value.userId ?? '')
  const userInitial = computed(() => userIdText.value.slice(0, 1).toUpperCase() || 'P')
  const userLabel = computed(() => userIdText.value === ''
    ? 'Field user'
    : `User ${userIdText.value.slice(0, 8)}`)
  async function removeAuthSession() {
    await $fetch('/api/auth/logout', {
      method: 'POST'
    })

    resetAuthentication()

    await navigateTo({
      path: '/login'
    })
  }
</script>

<style module>
  .layout {
    min-block-size: 100dvh;
    display: grid;
    grid-template-columns: 1fr;
    background:
      linear-gradient(180deg, var(--color-background-page), var(--color-background-muted));

    @media (width >= 900px) {
      grid-template-columns: var(--layout-sidebar-width) minmax(0, 1fr);
    }
  }

  .sidebar {
    display: none;
    position: sticky;
    inset-block-start: 0;
    block-size: 100dvh;
    padding: var(--spacing-24) var(--spacing-16) var(--spacing-16);
    border-inline-end: 1px solid var(--color-border-subtle);
    background: color-mix(in oklch, var(--color-background-elevated) 52%, transparent);
    gap: var(--spacing-24);
    flex-direction: column;

    @media (width >= 900px) {
      display: flex;
    }
  }

  .brand {
    display: grid;
    gap: var(--spacing-4);
    color: inherit;
    text-decoration: none;
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-14);

    &:focus-visible {
      background: color-mix(in oklch, var(--color-surface-primary), transparent 30%);
    }

    &:hover {
      background: color-mix(in oklch, var(--color-surface-primary), transparent 30%);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }
  }

  .brandMark {
    font-size: var(--font-size-30);
    line-height: var(--line-height-tight);
    letter-spacing: 0;
    font-weight: var(--font-weight-bold);
  }

  .brandPunctuation {
    color: var(--color-accent-primary);
    font-style: normal;
  }

  .logoutButton {
    appearance: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    inline-size: 100%;
    min-height: var(--layout-touch-target);
    padding: 0 var(--spacing-12);
    border-radius: var(--border-radius-14);
    color: var(--color-text-secondary);
    background: transparent;
    text-decoration: none;
    border: 1px solid transparent;
    font: inherit;
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      border-color var(--transition-duration-normal) var(--transition-easing-standard),
      color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:focus-visible {
      background: var(--color-surface-primary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
    }

    &:hover {
      background: var(--color-surface-primary);
      border-color: var(--color-border-subtle);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }
  }

  .navigationIcon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .main {
    min-inline-size: 0;
    padding-block-end: calc(var(--layout-dock-height) + var(--spacing-24));

    @media (width >= 900px) {
      padding-block-end: var(--spacing-32);
    }
  }

  .mobileHeader {
    inline-size: min(100%, var(--layout-content-max-width));
    margin: 0 auto;
    display: flex;
    align-items: center;
    padding: calc(var(--spacing-24) + var(--layout-safe-top)) var(--spacing-16) 0;

    @media (width >= 900px) {
      display: none;
    }
  }

  .mobileBrand {
    display: grid;
    place-items: center;
    inline-size: var(--layout-touch-target);
    block-size: var(--layout-touch-target);
    color: var(--color-accent-primary);
    border-radius: var(--border-radius-14);
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

  .mobileLogo {
    inline-size: 2.5rem;
    aspect-ratio: 1;
    background: currentColor;
    mask: url("/images/logo.svg") center / contain no-repeat;
  }

  .content {
    inline-size: min(100%, var(--layout-content-max-width));
    margin: 0 auto;
    padding: var(--spacing-24) var(--spacing-16) 0;
  }

  .sidebarFoot {
    margin-block-start: auto;
    display: grid;
    gap: var(--spacing-12);
    padding-block-start: var(--spacing-16);
    border-block-start: 1px solid var(--color-border-subtle);
  }

</style>
