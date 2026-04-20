<template>
  <PageContent page-title="Dashboard">
    <section :class="$style.hero">
      <p :class="$style.kicker">
        Base camp
      </p>

      <PerdHeading :level="2" :class="$style.title">
        Welcome to Perd.
      </PerdHeading>

      <p :class="$style.lede">
        Your dashboard will live here. The catalog browsing flow is still being rebuilt in staged iterations.
      </p>

      <div :class="$style.actions">
        <PerdButton
          variant="secondary"
          icon="tabler:binoculars"
          @click="goToCatalog"
        >
          Browse catalog
        </PerdButton>

        <PerdLink to="/inventory">
          Open inventory
        </PerdLink>
      </div>
    </section>
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta, navigateTo } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'

  definePageMeta({
    layout: 'page'
  })

  function goToCatalog() {
    void navigateTo('/catalog')
  }
</script>

<style module>
  .hero {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-32) var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    background:
      radial-gradient(circle at top right, color-mix(in oklch, var(--color-accent-base), transparent 84%), transparent 32%),
      linear-gradient(180deg, var(--color-surface-base), var(--color-background-sunken));
    min-height: min(70vh, 34rem);
    align-content: center;
  }

  .kicker {
    margin: 0;
    font-size: var(--font-size-12);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-accent-base);
  }

  .title {
    max-width: 12ch;
  }

  .lede {
    margin: 0;
    max-width: 44rem;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-16);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-12);
    align-items: center;
  }
</style>
