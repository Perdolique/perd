<template>
  <PageContent page-title="Home">
    <div :class="$style.component">
      <NuxtLink to="/packs" :class="$style.primaryAction">
        <span :class="$style.primaryIcon" aria-hidden="true">
          <Icon name="tabler:route" />
        </span>

        <span :class="$style.primaryText">
          <span :class="$style.primaryLabel">Packs</span>
          <span :class="$style.primaryMeta">Plan and check gear</span>
        </span>

        <Icon name="tabler:arrow-right" :class="$style.arrow" aria-hidden="true" />
      </NuxtLink>

      <div :class="$style.grid" aria-label="Quick actions">
        <NuxtLink to="/catalog" :class="$style.card">
          <Icon name="tabler:package" :class="$style.cardIcon" aria-hidden="true" />
          <span>Catalog</span>
        </NuxtLink>

        <NuxtLink to="/inventory" :class="$style.card">
          <Icon name="tabler:backpack" :class="$style.cardIcon" aria-hidden="true" />
          <span>Gear</span>
        </NuxtLink>
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
  }

  .primaryAction {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-16);
    min-block-size: 6rem;
    padding: var(--spacing-20);
    border-radius: var(--border-radius-28);
    background: var(--color-accent-primary);
    color: var(--color-accent-contrast);
    text-decoration: none;
    box-shadow: var(--shadow-medium);
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover,
    &:focus-visible {
      background: var(--color-accent-hover);
      box-shadow: var(--shadow-large);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus), var(--shadow-large);
    }

  }

  .primaryIcon {
    display: grid;
    place-items: center;
    inline-size: 3rem;
    block-size: 3rem;
    border-radius: var(--border-radius-20);
    background: color-mix(in oklch, var(--color-accent-contrast) 14%, transparent);
    font-size: var(--font-size-24);
  }

  .primaryText {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .primaryLabel {
    font-size: var(--font-size-24);
    line-height: var(--line-height-tight);
    font-weight: var(--font-weight-bold);
  }

  .primaryMeta {
    color: color-mix(in oklch, var(--color-accent-contrast) 78%, transparent);
    font-size: var(--font-size-14);
  }

  .arrow {
    font-size: var(--font-size-24);
  }

  .grid {
    display: grid;
    gap: var(--spacing-12);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  }

  .card {
    display: grid;
    gap: var(--spacing-16);
    min-block-size: 8rem;
    align-content: space-between;
    padding: var(--spacing-16);
    border-radius: var(--border-radius-20);
    border: 1px solid var(--color-border-subtle);
    background: var(--color-surface-primary);
    color: var(--color-text-primary);
    text-decoration: none;
    font-size: var(--font-size-17);
    font-weight: var(--font-weight-semibold);
    transition:
      background-color var(--transition-duration-normal) var(--transition-easing-standard),
      box-shadow var(--transition-duration-normal) var(--transition-easing-standard);

    &:hover,
    &:focus-visible {
      background: var(--color-surface-secondary);
      box-shadow: var(--shadow-small);
    }

    &:focus-visible {
      box-shadow: var(--shadow-focus), var(--shadow-small);
    }

  }

  .cardIcon {
    color: var(--color-accent-primary);
    font-size: var(--font-size-24);
  }
</style>
