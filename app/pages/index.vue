<template>
  <div :class="$style.component">
    🐕💨
  </div>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports';

  definePageMeta({
    layout: 'page'
  })
</script>

<style module>
  .component {
    text-align: center;
    font-size: 64px;
    padding-top: 32px;
  }
</style>
