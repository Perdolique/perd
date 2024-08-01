<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script lang="ts" setup>
  useHead({
    link: [{
      rel: 'icon',
      type: 'image/png',
      href: '/dog.png'
    }]
  })
</script>

<style lang="scss">
  @import "~/assets/styles/base";

  body {
    margin: 0;
    background-color: ghostwhite;
    color: var(--color-primary);
  }

  // Reset default dialog styles
  dialog {
    padding: 0;
    border: none;
    background: none;
    color: var(--color-primary);
  }

  // Apply global styles
  input::placeholder {
    color: var(--input-color-placeholder);
  }
</style>
