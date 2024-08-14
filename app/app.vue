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

  @layer {
    body {
      margin: 0;
      background-color: var(--color-background);
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
    input[type="text"] {
      width: 100%;
      outline: none;
      border: 1px solid color-mix(in srgb, var(--color-primary), transparent 75%);
      padding: var(--spacing-12);
      border-radius: var(--border-radius-16);
      font-size: var(--font-size-16);
      color: var(--color-primary);
      background-color: var(--input-color-background);
    }

    input::placeholder {
      color: var(--input-color-placeholder);
    }
  }
</style>
