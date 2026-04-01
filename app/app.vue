<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script lang="ts" setup>
  import { useHead } from '#imports'

  useHead({
    link: [{
      rel: 'icon',
      type: 'image/png',
      href: '/dog.png'
    }]
  })
</script>


