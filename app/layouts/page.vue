<template>
  <div :class="$style.layout">
    <PerdSidebar />

    <div :class="$style.main">
      <PageHeader />

      <div :class="$style.content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import PerdSidebar from '~/components/PerdSidebar/PerdSidebar.vue';
  import PageHeader from '~/components/PageHeader.vue';
</script>

<style lang="scss" module>
  .layout {
    height: 100%;
    display: flex;
  }

  .main {
    flex: 1;
    overflow: auto;
  }

  .content {
    padding: var(--spacing-16);
  }
</style>
