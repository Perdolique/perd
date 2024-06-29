<template>
  <div :class="$style.container">
    <button
      :class="$style.button"
      @click="handlePostClick"
    >
      POST
    </button>
    <button
      :class="$style.button"
      @click="handleGetClick"
    >
      GET
    </button>
    <button
      :class="$style.button"
      @click="handleCleanClick"
    >
      Clean
    </button>
  </div>
</template>

<script lang="ts" setup>
  async function handlePostClick() {
    const response = await $fetch('/api/user', {
      method: 'post'
    })

    console.log('POST', response);
  }

  async function handleGetClick() {
    const response = await $fetch('/api/user', {
      method: 'get'
    })

    console.log('GET', response);
  }

  async function handleCleanClick() {
    const response = await $fetch('/api/user/clean', {
      method: 'post'
    })

    console.log('Cleaned', response);
  }
</script>

<style module>
  .container {
    display: grid;
    grid-auto-flow: column;
  }

  .button {
    padding: 0.5rem 1rem;
  }
</style>
