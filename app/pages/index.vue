<template>
  <PageContent page-title="Dashboard">
    <template #actions>
      <PerdButton
        variant="secondary"
        icon="tabler:binoculars"
        @click="goToCatalog"
      >
        Browse catalog
      </PerdButton>

      <PerdButton icon="tabler:backpack" @click="goToInventory">
        Open inventory
      </PerdButton>
    </template>

    <div :class="$style.component">
      <section :class="$style.introCard">
        <p :class="$style.dateLabel">
          {{ dashboardDateLabel }}
        </p>

        <PerdHeading :level="2" :class="$style.title">
          Welcome to Perd.
        </PerdHeading>

        <p :class="$style.lede">
          This route stays intentionally lightweight while the first trip-oriented workflow lands. The live catalog and inventory flows below are ready to use today.
        </p>
      </section>

      <section :class="$style.quickGrid" aria-label="Available workspace flows">
        <NuxtLink to="/catalog" :class="$style.quickCard">
          <p :class="$style.quickLabel">
            Catalog
          </p>

          <div :class="$style.quickHeading">
            <span>Browse approved gear</span>

            <Icon name="tabler:arrow-right" aria-hidden="true" />
          </div>

          <p :class="$style.quickDescription">
            Explore the current read-only catalog and open item detail pages without leaving the signed-in workspace.
          </p>
        </NuxtLink>

        <NuxtLink to="/inventory" :class="$style.quickCard">
          <p :class="$style.quickLabel">
            Gear
          </p>

          <div :class="$style.quickHeading">
            <span>Manage saved items</span>

            <Icon name="tabler:arrow-right" aria-hidden="true" />
          </div>

          <p :class="$style.quickDescription">
            Review the gear you already saved from the catalog and remove items again from your personal inventory.
          </p>
        </NuxtLink>
      </section>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta, navigateTo } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'

  definePageMeta({
    layout: 'page'
  })

  const dashboardDateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date())

  function goToCatalog() {
    void navigateTo('/catalog')
  }

  function goToInventory() {
    void navigateTo('/inventory')
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .introCard {
    display: grid;
    gap: var(--spacing-16);
    padding: var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    background:
      radial-gradient(circle at top right, color-mix(in oklch, var(--color-accent-base), transparent 84%), transparent 32%),
      linear-gradient(180deg, var(--color-surface-base), var(--color-background-sunken));
    min-block-size: min(24rem, 60vh);
    align-content: start;
  }

  .dateLabel {
    margin: 0;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .title {
    max-inline-size: 12ch;
  }

  .lede {
    margin: 0;
    max-inline-size: 44rem;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-16);
  }

  .quickGrid {
    display: grid;
    gap: var(--spacing-16);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  }

  .quickCard {
    display: grid;
    gap: var(--spacing-12);
    padding: var(--spacing-24);
    border-radius: var(--border-radius-24);
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-base);
    color: inherit;
    text-decoration: none;
    box-shadow: var(--shadow-1);
    outline: 2px solid transparent;
    outline-offset: 3px;
    transition:
      border-color var(--transition-duration-base) var(--transition-easing-out),
      background-color var(--transition-duration-base) var(--transition-easing-out),
      transform var(--transition-duration-quick) var(--transition-easing-out);

    &:focus-visible,
    &:hover {
      background: var(--color-surface-subtle);
      border-color: var(--color-border-default);
      transform: translateY(-1px);
    }

    &:focus-visible {
      outline-color: var(--color-accent-ring);
    }

    &:active {
      transform: translateY(0);
    }
  }

  .quickLabel {
    margin: 0;
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .quickHeading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0;
    line-height: var(--line-height-snug);
    text-wrap: balance;
    color: var(--color-text-primary);
  }

  .quickDescription {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  @media (prefers-reduced-motion: reduce) {
    .quickCard:focus-visible,
    .quickCard:hover,
    .quickCard:active {
      transform: none;
    }
  }
</style>
