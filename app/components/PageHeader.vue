<template>
  <nav :class="$style.component">
    <NuxtLink
      to="/"
      :class="$style.logo"
    >
      🐕💨
    </NuxtLink>

    <section :class="$style.links">
      <PerdLink
        v-if="isAuthenticated"
        to="/inventory"
      >
        Inventory
      </PerdLink>

      <PerdLink
        v-if="user.isAdmin"
        to="/manager/equipment"
      >
        Equipment manager
      </PerdLink>

      <PerdLink
        v-if="isAuthenticated"
        to="/checklists"
      >
        Checklists
      </PerdLink>
    </section>

    <section :class="$style.buttons">
      <PerdButton
        v-if="isAuthenticated"
        @click="removeAuthSession"
      >
        Log out
      </PerdButton>
    </section>
  </nav>
</template>

<script lang="ts" setup>
  import PerdLink from '~/components/PerdLink.vue';
  import PerdButton from '~/components/PerdButton.vue';

  const { user, isAuthenticated, resetAuthentication } = useUserStore()

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
  .component {
    display: grid;
    column-gap: var(--spacing-24);
    grid-template-columns: auto auto 1fr;
    width: 100%;
    height: 5rem;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-16) var(--spacing-32);
    box-shadow: 0 2px 10px rgb(0 0 0 / 15%);
  }

  .logo {
    font-size: 2rem;
    text-decoration: none;
  }

  .links {
    display: flex;
    gap: var(--spacing-16);
  }

  .buttons {
    display: flex;
    gap: var(--spacing-16);
    justify-self: end;
  }
</style>
