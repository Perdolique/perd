<template>
  <div :class="$style.layout">
    <aside :class="$style.sidebar" data-testid="shell-sidebar">
      <NuxtLink to="/" :class="$style.brand">
        <span :class="$style.brandMark">perd<em>.</em></span>
        <span :class="$style.brandMeta">Field companion</span>
      </NuxtLink>

      <nav :class="$style.navGroup" aria-label="Workspace navigation">
        <p :class="$style.navTitle">
          Workspace
        </p>

        <NuxtLink
          v-for="item in workspaceNavigationItems"
          :key="item.to"
          :to="item.to"
          :class="item.className"
        >
          <Icon :name="item.icon" :class="$style.navIcon" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div :class="$style.sidebarFoot">
        <NuxtLink
          to="/account"
          :class="accountCardClass"
          aria-label="Account"
        >
          <span :class="$style.avatar" aria-hidden="true">
            {{ userInitial }}
          </span>

          <div :class="$style.userMeta">
            <strong>{{ userLabel }}</strong>
            <span>{{ userRole }}</span>
          </div>
        </NuxtLink>

        <button
          type="button"
          :class="$style.logoutButton"
          @click="removeAuthSession"
        >
          <Icon name="tabler:logout-2" :class="$style.navIcon" />
          <span>Log out</span>
        </button>
      </div>
    </aside>

    <div :class="$style.main">
      <header :class="$style.topbar" data-testid="shell-topbar">
        <NuxtLink to="/" :class="$style.topbarBrand">
          perd<em>.</em>
        </NuxtLink>

        <span :class="$style.topbarPath">
          / {{ currentSectionLabel }}
        </span>

        <div :class="$style.topbarSpacer" />

        <NuxtLink
          to="/account"
          :class="$style.topbarAction"
          aria-label="Open account"
        >
          <Icon name="tabler:user" />
        </NuxtLink>

        <button
          type="button"
          :class="$style.topbarAction"
          aria-label="Log out"
          @click="removeAuthSession"
        >
          <Icon name="tabler:logout-2" />
        </button>
      </header>

      <div :class="$style.content">
        <slot />
      </div>
    </div>

    <nav :class="$style.dock" data-testid="shell-dock" aria-label="Primary navigation">
      <NuxtLink
        v-for="item in dockNavigationItems"
        :key="item.to"
        :to="item.to"
        :class="item.className"
      >
        <span :class="$style.dockIcon">
          <Icon :name="item.icon" />
        </span>
        <span>{{ item.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
  import { computed, useCssModule } from 'vue'
  import { $fetch } from 'ofetch'
  import { navigateTo, useRoute, useUserStore } from '#imports'

  const workspaceNavigation = [{
    icon: 'tabler:home-2',
    label: 'Dashboard',
    to: '/'
  }, {
    icon: 'tabler:package',
    label: 'Catalog',
    to: '/catalog'
  }, {
    icon: 'tabler:backpack',
    label: 'Gear',
    to: '/inventory'
  }] as const

  const dockNavigation = [
    ...workspaceNavigation,
    {
      icon: 'tabler:user',
      label: 'Account',
      to: '/account'
    }
  ] as const
  const route = useRoute()
  const { resetAuthentication, user } = useUserStore()
  const styles = useCssModule()

  function isRouteActive(targetPath: string) {
    if (targetPath === '/') {
      return route.path === '/'
    }

    return route.path === targetPath || route.path.startsWith(`${targetPath}/`)
  }

  const workspaceNavigationItems = computed(() => workspaceNavigation.map((item) => {
    return {
      className: [styles.navItem, { active: isRouteActive(item.to) }],
      icon: item.icon,
      label: item.label,
      to: item.to
    }
  }))

  const dockNavigationItems = computed(() => dockNavigation.map((item) => {
    return {
      className: [styles.dockItem, { active: isRouteActive(item.to) }],
      icon: item.icon,
      label: item.label,
      to: item.to
    }
  }))

  const accountCardClass = computed(() => [styles.userCard, { active: isRouteActive('/account') }])

  const currentSectionLabel = computed(() => {
    const activeItem = dockNavigation.find((item) => isRouteActive(item.to))

    return activeItem?.label ?? 'Dashboard'
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

    & em {
      color: var(--color-accent-base);
      font-style: normal;
    }
  }

  .brandMeta,
  .navTitle {
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .navGroup {
    display: grid;
    gap: var(--spacing-4);
  }

  .navTitle {
    margin: 0;
    padding: var(--spacing-8) var(--spacing-12) 0;
  }

  .navItem,
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

  .navIcon {
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

  .userCard {
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

  .avatar {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
    background: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-weight: var(--font-weight-bold);
  }

  .userMeta {
    min-width: 0;
    display: grid;
    gap: 0.15rem;

    & strong,
    & span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & strong {
      font-size: var(--font-size-14);
      color: var(--color-text-primary);
    }

    & span {
      font-size: var(--font-size-12);
      color: var(--color-text-muted);
    }
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-12) var(--spacing-16);
    border-bottom: 1px solid var(--color-border-subtle);
    background: color-mix(in oklch, var(--color-background-raised), transparent 9%);
    backdrop-filter: blur(14px) saturate(1.3);

    @media (width >= 900px) {
      display: none;
    }
  }

  .topbarBrand {
    color: inherit;
    text-decoration: none;
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-bold);
    letter-spacing: -0.04em;

    & em {
      color: var(--color-accent-base);
      font-style: normal;
    }
  }

  .topbarPath {
    font-size: var(--font-size-12);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .topbarSpacer {
    flex: 1;
  }

  .topbarAction {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--border-radius-12);
    color: var(--color-text-secondary);
    text-decoration: none;
    background: transparent;
    border: 1px solid transparent;
    outline: none;
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
  }

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
