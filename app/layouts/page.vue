<template>
  <div :class="$style.component">
    <PageHeader />

    <div :class="$style.content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
  import PageHeader from '~/components/PageHeader.vue';
</script>

<style lang="scss" module>
  .component {
    display: grid;
    grid-template-rows: auto 1fr;
    row-gap: var(--spacing-16);
  }

  .content {
    width: 100%;
    padding: 0 var(--spacing-16) var(--spacing-16);

    @include tablet() {
      justify-self: center;
      max-width: var(--screen-tablet);
    }
  }
</style>
