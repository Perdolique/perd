<template>
  <div :class="$style.component">
    <div
      :class="[$style.overlay, {
        shown: isSidebarShown
      }]"
      @click="hideSidebar"
    />

    <div
      ref="sidebarRef"
      :class="[$style.content, {
        collapsed: isSidebarCollapsed,
        shown: isSidebarShown
      }]"
    >
      <div>
        <SidebarItem
          to="/inventory"
          icon="tabler:backpack"
        >
          Inventory
        </SidebarItem>

        <SidebarItem
          to="/checklists"
          icon="tabler:check"
        >
          Checklists
        </SidebarItem>

        <SidebarItem
          v-if="user.isAdmin"
          to="/manager/equipment"
          icon="tabler:building-warehouse"
        >
          Equipment manager
        </SidebarItem>
      </div>

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
  import SidebarItem from './SidebarItem.vue'

  const { isSidebarCollapsed, toggleSidebarDesktop, isSidebarShown, hideSidebar } = useAppState()
  const { user } = useUserStore()
  const router = useRouter()
  const sidebarRef = useTemplateRef<HTMLDivElement>('sidebarRef')

  watch(router.currentRoute, hideSidebar);
</script>

<style lang="scss" module>
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
    background-color: var(--overlay-color-background);
    backdrop-filter: blur(0);
    opacity: 0;
    display: none;
    transition:
      backdrop-filter var(--transition-time-quick) ease-out,
      opacity var(--transition-time-quick) ease-out,
      display var(--transition-time-quick) allow-discrete;

    &:global(.shown) {
      opacity: 1;
      backdrop-filter: var(--overlay-backdrop-filter);
      display: block;

      @starting-style {
        opacity: 0;
        backdrop-filter: blur(0);
      }

      @include tablet() {
        display: none;
      }
    }

    @include tablet() {
      display: none;
    }
  }

  .content {
    height: 100%;
    position: absolute;
    width: 200px;
    display: grid;
    align-content: space-between;
    background-color: var(--background-200);
    overflow: hidden;
    translate: -100% 0;
    transition: translate var(--transition-time-quick) ease-out;

    &:global(.shown) {
      translate: 0 0;
    }

    @include tablet() {
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
    background-color: var(--background-200);
    outline: none;
    text-align: left;
    transition: background-color var(--transition-time-quick) ease-out;

    @include tablet() {
      display: block;
    }

    &:focus-visible,
    &:hover {
      background-color: var(--background-300);
    }
  }
</style>
