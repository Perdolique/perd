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
        <QuickActionLink
          to="/catalog"
          icon="streamline-emojis:package"
          label="Catalog"
        />

        <QuickActionLink
          to="/inventory"
          icon="streamline-emojis:school-backpack"
          label="Gear"
        />
      </div>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { definePageMeta } from '#imports'
  import PageContent from '~/components/layout/PageContent.vue'
  import QuickActionLink from '~/components/QuickActionLink.vue'

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
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 9.5rem));
  }
</style>
