<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script lang="ts" setup>
  const isAuthorized = useState('isAuthorized', () => false)
  const { data } = await useFetch('/api/user')

  if (data.value?.userId !== undefined) {
    isAuthorized.value = true
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
