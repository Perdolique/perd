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
    >
      <div />

      <button
        :class="$style.toggle"
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
  import { useAppState, useRouter } from '#imports';

  const { isSidebarCollapsed, toggleSidebarDesktop, isSidebarShown, hideSidebar } = useAppState()
  const router = useRouter()

  watch(router.currentRoute, hideSidebar);
</script>

<style module>
  .component {
    position: relative;
    z-index: 3;
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
    width: 200px;
    display: grid;
    align-content: space-between;
    background-color: var(--color-background-200);
    overflow: hidden;
    translate: -100% 0;
    transition: translate var(--transition-time-quick) ease-out;

    &:global(.shown) {
      translate: 0 0;
    }

    @media (width >= 768px) {
      position: relative;
      transition: width var(--transition-time-quick) ease-out;
      translate: 0 0;

      &:global(.collapsed) {
        width: 50px;
      }
    }
  }

  .toggle {
    display: none;
    padding: var(--spacing-12);
    background-color: var(--color-background-200);
    outline: none;
    text-align: left;
    transition: background-color var(--transition-time-quick) ease-out;

    @media (width >= 768px) {
      display: block;
    }

    &:focus-visible,
    &:hover {
      background-color: var(--color-background-300);
    }
  }
</style>
