<template>
  <div :class="$style.layout">
    <PerdSidebar />

    <div :class="$style.main">
      <PageHeader />

      <div :class="$style.content">
        <slot />
      </div>

      <PageFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
  import PerdSidebar from '~/components/PerdSidebar/PerdSidebar.vue';
  import PageHeader from '~/components/PageHeader.vue';
  import PageFooter from '~/components/PageFooter.vue';
</script>

<style lang="scss" module>
  .layout {
    height: 100%;
    display: flex;
  }

  .main {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }

  .content {
    flex: 1;
    padding: var(--spacing-16);
    max-width: var(--screen-laptop);
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
</style>
