<template>
  <PerdToaster />

  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script lang="ts" setup>
  import PerdToaster from '~/components/PerdToaster.vue';

  useHead({
    link: [{
      rel: 'icon',
      type: 'image/png',
      href: '/dog.png'
    }]
  })
</script>

<style lang="scss">
  @use "~/assets/styles/base";

  @layer {
    html {
      margin: 0;
      padding: 0;
      height: 100%;
    }

    body {
      margin: 0;
      padding: 0;
      height: 100%;
      background-color: var(--background);
      color: var(--text);
    }

    .perd-root {
      height: 100%;
    }

    // Disable tap highlight color
    * {
      -webkit-tap-highlight-color: transparent;
    }

    // Reset default dialog styles
    dialog {
      padding: 0;
      border: none;
      background: none;
      color: var(--text);
    }

    // Reset default button styles
    button {
      appearance: none;
      border: none;
      padding: 0;
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
      }
    }
  }
</style>
