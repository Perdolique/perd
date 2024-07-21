<template>
  <div :class="$style.component">
    Hello, {{ user.userId }}
    <br />
    Your admin status is: {{ user.isAdmin }}
  </div>
</template>

<script lang="ts" setup>
  definePageMeta({
    layout: 'page'
  })

  const { user } = useUserStore()
</script>

<style module>
  .component {
    display: flex;
    justify-content: center;
    gap: var(--spacing-16);
    padding-top: var(--spacing-32);
  }
</style>
