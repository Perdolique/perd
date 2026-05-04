<template>
  <NuxtLink :to="packingListPath" :class="$style.component">
    <div :class="$style.header">
      <div :class="$style.titleRow">
        <span :class="$style.icon" aria-hidden="true">
          <Icon name="tabler:route" />
        </span>

        <div :class="$style.titleBlock">
          <p :class="$style.label">
            Pack
          </p>

          <h2 :class="$style.title">
            {{ packingList.name }}
          </h2>
        </div>
      </div>

      <div :class="$style.metaGrid">
        <div :class="$style.metaItem">
          <p :class="$style.metaLabel">
            Items
          </p>

          <p :class="$style.metaValue">
            0
          </p>
        </div>

        <div :class="$style.metaItem">
          <p :class="$style.metaLabel">
            Updated
          </p>

          <p :class="$style.metaValue">
            <time :datetime="packingList.updatedAt">{{ packingList.formattedUpdatedAt }}</time>
          </p>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackingListView } from '~/types/packing'

  interface Props {
    packingList: PackingListView;
  }

  const props = defineProps<Props>()
  const packingListPath = computed(() => `/packs/${props.packingList.id}`)
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
    background: var(--color-surface-base);
    border-radius: var(--border-radius-16);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    color: inherit;
    outline: 2px solid transparent;
    outline-offset: 3px;
    text-decoration: none;
    transition:
      border-color var(--transition-duration-quick) var(--transition-easing-out),
      box-shadow var(--transition-duration-quick) var(--transition-easing-out),
      transform var(--transition-duration-quick) var(--transition-easing-out);

    &:hover {
      border-color: var(--color-border-default);
      box-shadow: var(--shadow-2);
      transform: translateY(-1px);
    }

    &:focus-visible {
      border-color: var(--color-border-default);
      box-shadow: var(--shadow-2);
      outline-color: var(--color-accent-ring);
    }

    &:active {
      transform: translateY(0);
    }
  }

  .header {
    display: grid;
    gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
  }

  .titleRow {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--spacing-12);
    min-inline-size: 0;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    border-radius: var(--border-radius-16);
    background-color: var(--color-accent-subtle);
    color: var(--color-accent-base);
    font-size: 1.1rem;
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .label,
  .title,
  .metaLabel,
  .metaValue {
    margin: 0;
  }

  .label,
  .metaLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .title {
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  .component:hover .title,
  .component:focus-visible .title {
    color: var(--color-accent-base);
  }

  .metaGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, auto));
    gap: var(--spacing-16);

    @container (inline-size >= 40rem) {
      justify-content: end;
      text-align: right;
    }
  }

  .metaItem {
    min-inline-size: 0;
  }

  .metaValue {
    margin-block-start: var(--spacing-4);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  @media (prefers-reduced-motion: reduce) {
    .component,
    .component:hover,
    .component:active {
      transform: none;
    }
  }
</style>
