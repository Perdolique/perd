<template>
  <nav :class="$style.component">
    <button
      :class="$style.sidebarToggle"
      @click="toggleSidebarMobile"
    >
      <Icon
        name="tabler:menu-2"
        size="1.5em"
      />
    </button>

    <PerdButton
      v-if="isAuthenticated"
      :class="$style.button"
      @click="removeAuthSession"
      small
    >
      Log out
    </PerdButton>
  </nav>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue';

  const { isAuthenticated, resetAuthentication } = useUserStore()
  const { toggleSidebarMobile } = useAppState()

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

<style lang="scss" module>
  .component {
    display: flex;
    column-gap: var(--spacing-24);
    padding: var(--spacing-16) var(--spacing-32) var(--spacing-16) var(--spacing-24);
    background-color: var(--background-100);
    align-items: center;

    @include tablet() {
      padding: var(--spacing-16);
    }
  }

  .sidebarToggle {
    display: flex;
    padding: var(--spacing-8);
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius-12);
    outline: none;
    transition: background-color var(--transition-time-quick);
    background-color: var(--background-100);

    &:focus-visible,
    &:hover {
      background-color: var(--background-200);
    }

    &:active {
      background-color: var(--background-300);
    }

    @include tablet() {
      display: none;
    }
  }

  .button {
    margin-left: auto;
  }
</style>
