<template>
  <div
    :class="$style.component"
    :data-visible="visible"
    data-testid="gear-library-results-skeleton"
    aria-hidden="true"
  >
    <GearLibraryItemRowShell
      data-testid="gear-library-results-skeleton-row"
      has-action
    >
      <template #media="{ className }">
        <span :class="[className, $style.shimmer]" />
      </template>

      <template #action="{ className }">
        <div :class="className">
          <span :class="[$style.action, $style.shimmer]" />
        </div>
      </template>

      <template #identity="{ className }">
        <div :class="className">
          <span :class="[$style.brand, $style.shimmer]" />
          <span :class="[$style.name, $style.shimmer]" />
          <span :class="[$style.category, $style.shimmer]" />
        </div>
      </template>

      <template #properties="{ propertiesClass, propertyClass }">
        <div :class="propertiesClass">
          <div
            v-for="propertyIndex in propertyCount"
            :key="propertyIndex"
            :class="propertyClass"
          >
            <span :class="[$style.propertyName, $style.shimmer]" />
            <span :class="[$style.propertyValue, $style.shimmer]" />
          </div>
        </div>
      </template>
    </GearLibraryItemRowShell>
  </div>
</template>

<script lang="ts" setup>
  import GearLibraryItemRowShell from './GearLibraryItemRowShell.vue'

  interface Props {
    visible: boolean;
  }

  const propertyCount = 3

  defineProps<Props>()
</script>

<style module>
  @keyframes shimmer {
    to {
      background-position: -100% 0;
    }
  }

  .component {
    display: grid;
    opacity: 1;
    transition: opacity var(--transition-duration-fast) var(--transition-easing-standard);

    &[data-visible="false"] {
      opacity: 0;
    }
  }

  .shimmer {
    display: block;
    border-radius: var(--border-radius-6);
    background:
      linear-gradient(
        100deg,
        var(--color-surface-secondary) 20%,
        var(--color-surface-tertiary) 50%,
        var(--color-surface-secondary) 80%
      );
    background-position: 100% 0;
    background-size: 200% 100%;
    animation: shimmer 1.6s linear infinite;
    animation-play-state: paused;

    .component[data-visible="true"] & {
      animation-play-state: running;
    }

    @media (prefers-reduced-motion: reduce) {
      background: var(--color-surface-secondary);
      animation: none;
    }
  }

  .brand {
    inline-size: 30%;
    block-size: calc(var(--font-size-12) * var(--line-height-body));
  }

  .name {
    inline-size: 72%;
    block-size: calc(var(--font-size-17) * var(--line-height-snug));
  }

  .category {
    inline-size: 48%;
    block-size: calc(var(--font-size-14) * var(--line-height-body));
  }

  .propertyName {
    inline-size: 68%;
    block-size: calc(var(--font-size-12) * var(--line-height-snug));
  }

  .propertyValue {
    inline-size: 46%;
    block-size: calc(var(--font-size-14) * var(--line-height-snug));
  }

  .action {
    inline-size: 8.5rem;
    block-size: var(--layout-button-height-small);
  }
</style>
