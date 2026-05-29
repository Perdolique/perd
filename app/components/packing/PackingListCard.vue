<template>
  <NuxtLink :to="packingListPath" :class="$style.component">
    <div :class="$style.header">
      <div :class="$style.titleRow">
        <span :class="$style.icon" aria-hidden="true">
          <Icon name="tabler:route" />
        </span>

        <div :class="$style.titleBlock">
          <div :class="$style.label">
            Pack
          </div>

          <h2 :class="$style.title">
            {{ packingList.name }}
          </h2>
        </div>
      </div>

      <dl :class="$style.metaGrid">
        <div :class="$style.metaItem">
          <dt :class="$style.metaLabel">
            Items
          </dt>

          <dd :class="$style.metaValue">
            {{ packingList.entryCount }}
          </dd>
        </div>

        <div :class="$style.metaItem">
          <dt :class="$style.metaLabel">
            Updated
          </dt>

          <dd :class="$style.metaValue">
            <time :datetime="packingList.updatedAt">{{ packingList.formattedUpdatedAt }}</time>
          </dd>
        </div>
      </dl>
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
    background: var(--color-surface-primary);
    border-radius: var(--border-radius-16);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    color: inherit;
    text-decoration: none;
    transition:
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover {
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-medium);

      & .title {
        color: var(--color-accent-primary);
      }
    }

    &:focus-visible {
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-focus), var(--shadow-medium);

      & .title {
        color: var(--color-accent-primary);
      }
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
    color: var(--color-accent-primary);
    font-size: 1.1rem;
  }

  .titleBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    margin: 0;
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
    font-weight: var(--font-weight-bold);
    overflow-wrap: anywhere;
  }

  .metaValue {
    margin: 0;
    margin-block-start: var(--spacing-4);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  .label {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .metaLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .metaGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, auto));
    gap: var(--spacing-16);
    margin: 0;

    @container (inline-size >= 40rem) {
      justify-content: end;
      text-align: right;
    }
  }

  .metaItem {
    min-inline-size: 0;
  }
</style>
