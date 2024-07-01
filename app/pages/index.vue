<template>
  <div :class="$style.component">
    <button @click="handleClick">
      Sign in anonymously
    </button>
  </div>
</template>

<script lang="ts" setup>
  async function handleClick() {
    const result = await $fetch('/api/auth/create-session', {
      method: 'post'
    })

    console.log(result);
  }
</script>

<style module>
  .component {
    height: 100vh;
    width: 100vw;
    display: grid;
    place-items: center;
  }
</style>
