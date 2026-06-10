<template>
  <PerdCard :class="$style.component">
    <div :class="$style.header">
      <PackingListIdentity :name="name" />

      <div :class="$style.aside">
        <div :class="$style.modeToggle" role="group" aria-label="Pack detail mode">
          <button
            type="button"
            :class="[$style.modeButton, {
              active: isPlanningMode
            }]"
            :aria-pressed="isPlanningMode"
            @click="emitModeUpdate('planning')"
          >
            <Icon name="tabler:edit-circle" aria-hidden="true" />
            Planning
          </button>

          <button
            type="button"
            :class="[$style.modeButton, {
              active: isChecklistMode
            }]"
            :aria-pressed="isChecklistMode"
            @click="emitModeUpdate('checklist')"
          >
            <Icon name="tabler:checkbox" aria-hidden="true" />
            Checklist
          </button>
        </div>

        <dl :class="$style.metaGrid">
          <div :class="$style.metaItem">
            <dt :class="$style.metaLabel">
              Items
            </dt>

            <dd :class="$style.metaValue">
              {{ entryCount }}
            </dd>
          </div>

          <div :class="$style.metaItem">
            <dt :class="$style.metaLabel">
              Packed
            </dt>

            <dd :class="$style.metaValue">
              {{ packedCount }}
            </dd>
          </div>

          <div :class="$style.metaItem">
            <dt :class="$style.metaLabel">
              Updated
            </dt>

            <dd :class="$style.metaValue">
              <time :datetime="updatedAt">{{ formattedUpdatedAt }}</time>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </PerdCard>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import type { PackDetailMode } from '~/types/packing'
  import PerdCard from '~/components/PerdCard.vue'
  import PackingListIdentity from '~/components/packing/PackingListIdentity.vue'

  interface Props {
    entryCount: number;
    formattedUpdatedAt: string;
    mode: PackDetailMode;
    name: string;
    packedCount: number;
    updatedAt: string;
  }

  type Emits = (event: 'update:mode', mode: PackDetailMode) => void

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const isPlanningMode = computed(() => props.mode === 'planning')
  const isChecklistMode = computed(() => props.mode === 'checklist')

  function emitModeUpdate(mode: PackDetailMode) {
    emit('update:mode', mode)
  }
</script>

<style module>
  .component {
    container-type: inline-size;
    overflow: hidden;
    background:
      linear-gradient(
        145deg,
        color-mix(in oklch, var(--color-accent-primary), transparent 94%),
        var(--color-surface-primary) 58%
      );
  }

  .header {
    display: grid;
    gap: var(--spacing-24);
  }

  .aside {
    display: grid;
    gap: var(--spacing-16);
    min-inline-size: 0;
  }

  .modeToggle {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    inline-size: 100%;
    padding: var(--spacing-4);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .modeButton {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-8);
    min-block-size: 2.5rem;
    min-inline-size: 0;
    padding-inline: var(--spacing-12);
    border: 0;
    border-radius: var(--border-radius-12);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-medium);
    line-height: var(--line-height-snug);
    text-align: center;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:focus-visible {
      box-shadow: var(--shadow-focus);
    }

    &:global(.active) {
      background: var(--color-surface-primary);
      color: var(--color-text-primary);
      box-shadow: 0 1px 2px color-mix(in oklch, var(--color-text-primary), transparent 92%);
    }
  }

  .metaGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    inline-size: 100%;
    gap: 0;
    margin: 0;
    overflow: hidden;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: color-mix(in oklch, var(--color-surface-primary), var(--color-surface-secondary) 52%);

    @container (inline-size < 34rem) {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .metaItem {
    min-inline-size: 0;
    padding: var(--spacing-12);

    & + & {
      border-inline-start: 1px solid var(--color-border-subtle);
    }

    @container (inline-size < 34rem) {
      & + & {
        border-block-start: 1px solid var(--color-border-subtle);
        border-inline-start: 0;
      }
    }
  }

  .metaLabel {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .metaValue {
    margin: 0;
    margin-block-start: var(--spacing-4);
    color: var(--color-text-primary);
    font-weight: var(--font-weight-medium);
    overflow-wrap: anywhere;
  }

  @container (inline-size >= 48rem) {
    .header {
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 24rem);
      align-items: start;
    }

    .aside {
      inline-size: 100%;
      justify-items: end;
    }
  }
</style>
