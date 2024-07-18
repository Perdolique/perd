<template>
  <div :class="$style.component">
    <div v-if="isAuthorized">
      Hello, {{ userState.userId }}
      <br />
      Your admin status is: {{ userState.isAdmin }}
    </div>

    <template v-else>
      <PerdButton @click="handleSignInClick">
        Sign in anonymously
      </PerdButton>

      <PerdButton @click="handleSignInAdminClick">
        Sign in as admin
      </PerdButton>
    </template>
  </div>
</template>

<script lang="ts" setup>
  const { userState, isAuthorized } = useUserState()

  async function handleSignInClick() {
    // TODO: add types for response
    const response = await $fetch('/api/auth/create-session', {
      method: 'post'
    })

    if (typeof response.userId === 'string') {
      userState.value.userId = response.userId
    }

    // TODO: unify userState update
    if (response.isAdmin === true) {
      userState.value.isAdmin = true
    }
  }

  async function handleSignInAdminClick() {
    // TODO: add types for response
    const response = await $fetch('/api/auth/create-session', {
      method: 'post',

      body: {
        isAdmin: true
      }
    })

    if (typeof response.userId === 'string') {
      userState.value.userId = response.userId
    }

    if (response.isAdmin === true) {
      userState.value.isAdmin = true
    }
  }
</script>

<style module>
  .component {
    display: flex;
    justify-content: center;
    gap: var(--spacing-16);
  }
</style>
