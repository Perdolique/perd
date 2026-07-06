<template>
  <NuxtLink
    :to="to"
    :class="[$style.component, {
      'with-media': showMedia
    }]"
  >
    <span v-if="showMedia" :class="$style.media">
      <slot name="media">
        <Icon :name="iconName" aria-hidden="true" />
      </slot>
    </span>

    <span :class="$style.body">
      <span :class="$style.title">
        {{ title }}
      </span>

      <span v-if="showSubtitle" :class="$style.subtitle">
        {{ subtitle }}
      </span>
    </span>

    <span :class="$style.trailingGroup">
      <span v-if="showTrailing" :class="$style.trailing">
        <slot name="trailing" />
      </span>

      <Icon name="hugeicons:arrow-right-01" :class="$style.arrow" aria-hidden="true" />
    </span>
  </NuxtLink>
</template>

<script lang="ts" setup>
  import { computed, useSlots } from 'vue'

  interface Props {
    icon?: string;
    subtitle?: string;
    title: string;
    to: string;
  }

  const props = defineProps<Props>()
  const slots = useSlots()

  const hasMediaSlot = computed(() => slots.media !== undefined)
  const showIcon = computed(() => props.icon !== undefined && props.icon !== '')
  const showMedia = computed(() => hasMediaSlot.value || showIcon.value)
  const showTrailing = computed(() => slots.trailing !== undefined)
  const showSubtitle = computed(() => props.subtitle !== undefined && props.subtitle !== '')
  const iconName = computed(() => props.icon ?? '')
</script>

<style module>
  .component {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--spacing-16);
    min-block-size: 5.25rem;
    padding: var(--spacing-16);
    border: 1px solid transparent;
    border-radius: var(--border-radius-20);
    background: var(--color-surface-primary);
    color: inherit;
    text-decoration: none;
    box-shadow: var(--shadow-small);
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:global(.with-media) {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }

    &:hover {
      border-color: var(--color-border-subtle);
      background: var(--color-background-elevated);
      box-shadow: var(--shadow-medium);
    }

    &:focus-visible {
      border-color: var(--color-border-strong);
      background: var(--color-background-elevated);
      box-shadow: var(--shadow-focus), var(--shadow-medium);
      outline: none;
    }

    &:active {
      background: var(--color-accent-subtle);
    }
  }

  .media {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 3.25rem;
    block-size: 3.25rem;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background:
      linear-gradient(
        145deg,
        var(--color-accent-subtle),
        color-mix(in oklch, var(--color-surface-primary), var(--color-accent-subtle) 46%)
      );
    color: var(--color-accent-primary);
    font-size: var(--font-size-24);
  }

  .body {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .title {
    color: var(--color-text-primary);
    font-size: var(--font-size-20);
    font-weight: var(--font-weight-bold);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .subtitle {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-16);
    line-height: var(--line-height-snug);
    overflow-wrap: anywhere;
  }

  .trailingGroup {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-12);
  }

  .trailing {
    display: inline-flex;
    align-items: center;
  }

  .arrow {
    flex-shrink: 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-20);

    .component:hover &,
    .component:focus-visible & {
      color: var(--color-accent-primary);
    }
  }
</style>
