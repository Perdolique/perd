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

    <PerdMenu
      v-if="isAuthenticated"
      :class="$style.profileMenu"
    >
      <template #trigger="{ toggleMenu, isMenuVisible }">
        <button
          :class="[$style.profileTrigger, { active: isMenuVisible }]"
          @click="toggleMenu"
        >
          <Icon
            name="tabler:user"
            size="1.5em"
          />
        </button>
      </template>

      <OptionButton
        icon="tabler:user-circle"
        @click="navigateTo('/account')"
      >
        Account
      </OptionButton>

      <OptionButton
        icon="tabler:logout"
        @click="removeAuthSession"
      >
        Log out
      </OptionButton>
    </PerdMenu>
  </nav>
</template>

<script lang="ts" setup>
  import PerdMenu from '~/components/PerdMenu.vue';
  import OptionButton from '~/components/PerdMenu/OptionButton.vue';

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

  .profileMenu {
    margin-left: auto;
  }

  .profileTrigger {
    width: 40px;
    height: 40px;
    cursor: pointer;
    padding: var(--spacing-8);
    border-radius: var(--border-radius-12);
    color: var(--text);
    background-color: transparent;
    outline: none;
    transition: background-color var(--transition-time-quick);


    &:focus-visible,
    &:hover {
      background-color: var(--background-200);
    }

    &:global(.active),
    &:active {
      background-color: var(--background-300);
    }
  }
</style>
