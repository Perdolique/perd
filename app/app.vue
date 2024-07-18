<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>

<script lang="ts" setup>
  const { userState } = useUserState()
  const { data } = await useFetch('/api/user')

  if (data.value?.userId !== undefined) {
    userState.value.userId = data.value.userId
  }

  if (data.value?.isAdmin === true) {
    userState.value.isAdmin = true
  }
</script>

<style lang="scss">
  @import "~/assets/styles/base";

  body {
    margin: 0;
    background-color: lavender;
    color: var(--color-blue-900);
  }
</style>
