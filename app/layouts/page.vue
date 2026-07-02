<template>
  <div :class="$style.layout">
    <aside :class="$style.sidebar" data-testid="shell-sidebar">
      <ShellBrandLink :class="$style.brand" />

      <ShellSidebarNavigation />

      <div :class="$style.sidebarFoot">
        <ShellUserCard
          :user-initial="userInitial"
          :user-label="userLabel"
        />
      </div>
    </aside>

    <div :class="$style.main">
      <header
        :class="$style.mobileHeader"
        data-testid="shell-mobile-header"
      >
        <ShellBrandLink
          :class="$style.mobileBrand"
        />
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
  import { useUserStore } from '#imports'
  import ShellBrandLink from '~/components/layout/ShellBrandLink.vue'
  import ShellDockNavigation from '~/components/layout/ShellDockNavigation.vue'
  import ShellSidebarNavigation from '~/components/layout/ShellSidebarNavigation.vue'
  import ShellUserCard from '~/components/layout/ShellUserCard.vue'

  const { user } = useUserStore()

  const userIdText = computed(() => user.value.userId ?? '')
  const userInitial = computed(() => userIdText.value.slice(0, 1).toUpperCase() || 'P')
  const userLabel = computed(() => userIdText.value === ''
    ? 'Field user'
    : `User ${userIdText.value.slice(0, 8)}`)
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
    min-block-size: var(--layout-touch-target);
    padding: var(--spacing-8) var(--spacing-12);
    border-radius: var(--border-radius-14);

    &:focus-visible {
      background: color-mix(in oklch, var(--color-surface-primary), transparent 30%);
    }

    &:hover {
      background: color-mix(in oklch, var(--color-surface-primary), transparent 30%);
    }
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
    min-inline-size: var(--layout-touch-target);
    min-block-size: var(--layout-touch-target);
    padding-inline: var(--spacing-4);
    border-radius: var(--border-radius-14);
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
