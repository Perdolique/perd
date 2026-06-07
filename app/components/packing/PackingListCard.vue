<template>
  <NuxtLink :to="packingListPath" :class="$style.component">
    <div :class="$style.header">
      <PackingListIdentity :name="packingList.name" />

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
  import PackingListIdentity from '~/components/packing/PackingListIdentity.vue'

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

      & :global(.packing-list-identity-title) {
        color: var(--color-accent-primary);
      }
    }

    &:focus-visible {
      border-color: var(--color-border-strong);
      box-shadow: var(--shadow-focus), var(--shadow-medium);

      & :global(.packing-list-identity-title) {
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

  .metaValue {
    margin: 0;
    margin-block-start: var(--spacing-4);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
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
