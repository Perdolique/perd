<template>
  <div :class="$style.component" />
</template>

<script lang="ts" setup>
  const message = 'Woof';
</script>

<style module>
  .component {
    --spinner-size: 24px;

    width: var(--spinner-size);
    height: var(--spinner-size);
    border: 3px solid rgb(0 0 0 / 15%);
    border-top: 3px solid currentColor;
    border-radius: 50%;
    animation: spin 0.5s linear infinite;
  }

  @keyframes spin {
    0% {
      rotate: 0;
    }

    100% {
      rotate: 360deg;
    }
  }
</style>
