<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script lang="ts" setup>
  import { useHead } from '#imports'

  useHead({
    meta: [{
      name: 'color-scheme',
      content: 'light dark'
    }],
    link: [{
      rel: 'icon',
      type: 'image/png',
      href: '/dog.png'
    }]
  })
</script>

