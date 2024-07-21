<template>
  <PageLayout>
    <div :class="$style.layout">
      <PerdHeading
        v-if="route.meta.title"
        :level="1"
      >
        {{ route.meta.title }}
      </PerdHeading>

      <slot />
    </div>
  </PageLayout>
</template>

<script lang="ts" setup>
  import PageLayout from '~/layouts/page.vue';
  import PerdHeading from '~/components/PerdHeading.vue';

  const route = useRoute();
</script>

<style module>
  .layout {
    display: grid;
    row-gap: var(--spacing-32);
  }
</style>
