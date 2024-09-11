<template>
  <Icon
    name="tabler:fidget-spinner"
    :class="$style.component"
  />
</template>

<style module>
  @keyframes spin {
    0% {
      rotate: 0;
    }

    100% {
      rotate: 360deg;
    }
  }

  .component {
    animation: spin 1s linear infinite;
  }
</style>
