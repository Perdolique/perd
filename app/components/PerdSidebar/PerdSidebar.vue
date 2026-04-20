<template>
  <div :class="$style.component">
    <div
      :class="[$style.overlay, {
        shown: isSidebarShown
      }]"
      @click="hideSidebar"
    />

    <div
      :class="[$style.content, {
        collapsed: isSidebarCollapsed,
        shown: isSidebarShown
      }]"
      data-testid="sidebar"
    >
      <nav
        :class="$style.navigation"
        aria-label="Sidebar navigation"
      >
        <NuxtLink
          to="/"
          :class="$style.navigationLink"
          exact-active-class="active"
        >
          <Icon
            name="tabler:layout-dashboard"
            size="1.5em"
          />

          <span :class="$style.navigationLabel">
            Dashboard
          </span>
        </NuxtLink>

        <NuxtLink
          to="/catalog"
          :class="$style.navigationLink"
          active-class="active"
        >
          <Icon
            name="tabler:package"
            size="1.5em"
          />

          <span :class="$style.navigationLabel">
            Catalog
          </span>
        </NuxtLink>

        <NuxtLink
          to="/inventory"
          :class="$style.navigationLink"
          active-class="active"
        >
          <Icon
            name="tabler:backpack"
            size="1.5em"
          />

          <span :class="$style.navigationLabel">
            Inventory
          </span>
        </NuxtLink>
      </nav>

      <button
        :class="$style.toggle"
        aria-label="Toggle sidebar"
        data-testid="sidebar-toggle"
        @click="toggleSidebarDesktop"
      >
        <Icon
          name="tabler:menu-2"
          size="1.5em"
        />
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { watch } from 'vue';
  import { useAppState, useRoute } from '#imports';

  const { isSidebarCollapsed, toggleSidebarDesktop, isSidebarShown, hideSidebar } = useAppState()
  const route = useRoute()

  watch(() => route.fullPath, hideSidebar);
</script>

<style module>
  .component {
    position: relative;
    z-index: 3;
    --sidebar-width: 200px;
    --sidebar-collapsed-width: 56px;
    --sidebar-control-size: 40px;
    --sidebar-collapsed-padding: var(--spacing-8);
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--color-overlay-background);
    backdrop-filter: blur(0);
    opacity: 0;
    display: none;
    transition:
      backdrop-filter var(--transition-time-quick) ease-out,
      opacity var(--transition-time-quick) ease-out,
      display var(--transition-time-quick) allow-discrete;

    &:global(.shown) {
      opacity: 1;
      backdrop-filter: blur(4px);
      display: block;

      @starting-style {
        opacity: 0;
        backdrop-filter: blur(0);
      }

      @media (width >= 768px) {
        display: none;
      }
    }

    @media (width >= 768px) {
      display: none;
    }
  }

  .content {
    height: 100%;
    position: absolute;
    width: var(--sidebar-width);
    display: grid;
    align-content: space-between;
    background-color: var(--color-background-200);
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
    translate: -100% 0;
    transition:
      translate var(--transition-time-quick) ease-out,
      visibility var(--transition-time-quick) allow-discrete;

    &:global(.shown) {
      visibility: visible;
      pointer-events: auto;
      translate: 0 0;
    }

    @media (width >= 768px) {
      position: relative;
      transition: width var(--transition-time-quick) ease-out;
      visibility: visible;
      pointer-events: auto;
      translate: 0 0;

      &:global(.collapsed) {
        width: var(--sidebar-collapsed-width);
      }
    }
  }

  .navigation {
    display: grid;
    align-content: start;
    gap: var(--spacing-8);
    padding: var(--spacing-12);

    @media (width >= 768px) {
      .content:global(.collapsed) & {
        justify-items: center;
        gap: var(--spacing-4);
        padding: var(--sidebar-collapsed-padding);
      }
    }
  }

  .navigationLink {
    display: flex;
    align-items: center;
    gap: var(--spacing-12);
    min-height: 48px;
    padding: var(--spacing-12);
    border-radius: var(--border-radius-12);
    color: var(--color-text);
    text-decoration: none;
    outline: none;
    transition:
      background-color var(--transition-time-quick) ease-out,
      color var(--transition-time-quick) ease-out;

    &:global(.active),
    &:focus-visible,
    &:hover {
      background-color: var(--color-background-300);
    }

    &:global(.active) {
      color: var(--color-primary-700);
    }

    @media (width >= 768px) {
      .content:global(.collapsed) & {
        justify-content: center;
        width: var(--sidebar-control-size);
        min-width: var(--sidebar-control-size);
        min-height: var(--sidebar-control-size);
        padding: 0;
        gap: 0;
      }
    }
  }

  .navigationLabel {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    transition: opacity var(--transition-time-quick) ease-out;

    @media (width >= 768px) {
      .content:global(.collapsed) & {
        opacity: 0;
        width: 0;
      }
    }
  }

  .toggle {
    appearance: none;
    border: none;
    cursor: pointer;
    display: none;
    width: var(--sidebar-control-size);
    min-width: var(--sidebar-control-size);
    min-height: var(--sidebar-control-size);
    margin: var(--spacing-12);
    padding: var(--spacing-8);
    background-color: var(--color-background-200);
    outline: none;
    border-radius: var(--border-radius-12);
    align-items: center;
    justify-content: center;
    transition: background-color var(--transition-time-quick) ease-out;

    @media (width >= 768px) {
      display: flex;

      .content:global(.collapsed) & {
        margin: var(--sidebar-collapsed-padding);
      }
    }

    &:focus-visible,
    &:hover {
      background-color: var(--color-background-300);
    }
  }
</style>
