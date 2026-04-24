<template>
  <div :class="$style.layout">
    <aside :class="$style.sidebar" data-testid="shell-sidebar">
      <NuxtLink to="/" :class="$style.brand">
        <span :class="$style.brandMark">
          perd<em :class="$style.brandPunctuation">.</em>
        </span>
        <span :class="$style.brandMeta">Field companion</span>
      </NuxtLink>

      <ShellSidebarNavigation />

      <div :class="$style.sidebarFoot">
        <ShellUserCard
          :user-initial="userInitial"
          :user-label="userLabel"
          :user-role="userRole"
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
      <ShellTopbar
        :current-section-label="currentSectionLabel"
        @logout="removeAuthSession"
      />

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
  import { navigateTo, useRoute, useUserStore } from '#imports'
  import ShellDockNavigation from '~/components/layout/ShellDockNavigation.vue'
  import ShellSidebarNavigation from '~/components/layout/ShellSidebarNavigation.vue'
  import ShellTopbar from '~/components/layout/ShellTopbar.vue'
  import ShellUserCard from '~/components/layout/ShellUserCard.vue'

  const route = useRoute()
  const { resetAuthentication, user } = useUserStore()

  function isRouteActive(targetPath: string) {
    if (targetPath === '/') {
      return route.path === '/'
    }

    return route.path === targetPath || route.path.startsWith(`${targetPath}/`)
  }

  const currentSectionLabel = computed(() => {
    if (isRouteActive('/catalog')) {
      return 'Catalog'
    }

    if (isRouteActive('/inventory')) {
      return 'Gear'
    }

    if (isRouteActive('/account')) {
      return 'Account'
    }

    return 'Dashboard'
  })

  const userIdText = computed(() => user.value.userId ?? '')
  const userInitial = computed(() => userIdText.value.slice(0, 1).toUpperCase() || 'P')
  const userLabel = computed(() => userIdText.value === ''
    ? 'Field user'
    : `User ${userIdText.value.slice(0, 8)}`)
  const userRole = computed(() => user.value.isAdmin ? 'Admin' : 'Explorer')

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
    min-height: 100dvh;
    display: grid;
    grid-template-columns: 1fr;
    background:
      linear-gradient(180deg, var(--color-background-base), color-mix(in oklch, var(--color-background-base), var(--color-background-sunken) 38%));

    @media (width >= 900px) {
      grid-template-columns: var(--layout-sidebar-width) minmax(0, 1fr);
    }
  }

  .sidebar {
    display: none;
    position: sticky;
    top: 0;
    height: 100dvh;
    padding: var(--spacing-24) var(--spacing-16) var(--spacing-16);
    border-right: 1px solid var(--color-border-subtle);
    background: var(--color-background-sunken);
    gap: var(--spacing-16);
    flex-direction: column;

    @media (width >= 900px) {
      display: flex;
    }
  }

  .brand {
    display: grid;
    gap: var(--spacing-8);
    color: inherit;
    text-decoration: none;
    outline: none;
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-16);

    &:focus-visible,
    &:hover {
      background: color-mix(in oklch, var(--color-surface-base), transparent 30%);
    }
  }

  .brandMark {
    font-size: var(--font-size-32);
    line-height: var(--line-height-tight);
    letter-spacing: -0.05em;
    font-weight: var(--font-weight-bold);
  }

  .brandPunctuation {
    color: var(--color-accent-base);
    font-style: normal;
  }

  .brandMeta {
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .logoutButton {
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

  .logoutButton {
    appearance: none;
    cursor: pointer;
    width: 100%;
    font: inherit;
  }

  .navigationIcon {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .main {
    min-width: 0;
    padding-bottom: calc(var(--layout-dock-height) + var(--spacing-24));

    @media (width >= 900px) {
      padding-bottom: var(--spacing-32);
    }
  }

  .content {
    width: min(100%, var(--layout-content-max-width));
    margin: 0 auto;
    padding: var(--spacing-24) var(--spacing-16) 0;
  }

  .sidebarFoot {
    margin-top: auto;
    display: grid;
    gap: var(--spacing-12);
    padding-top: var(--spacing-16);
    border-top: 1px solid var(--color-border-subtle);
  }

</style>
