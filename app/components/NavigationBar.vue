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
        v-if="userState.isAdmin"
        to="/manager/equipment"
      >
        Equipment manager
      </PerdLink>
    </section>

    <section :class="$style.buttons">
      <PerdButton
        v-if="isAuthorized"
        @click="removeAuthSession"
      >
        Log out
      </PerdButton>
    </section>
  </nav>
</template>

<script lang="ts" setup>
  const { userState, isAuthorized, resetUserState } = useUserState()

  async function removeAuthSession() {
    await $fetch('/api/auth/logout', {
      method: 'post'
    })

    resetUserState()

    navigateTo('/')
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
