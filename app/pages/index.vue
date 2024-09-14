<template>
  <div :class="$style.component">
    <div>
      Hello, {{ user.userId }}
    </div>

    <div>
      Your admin status is: {{ user.isAdmin }}
    </div>
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
    display: grid;
    justify-content: center;
    gap: var(--spacing-16);
    padding-top: var(--spacing-32);
  }
</style>
