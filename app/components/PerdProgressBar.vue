<template>
  <div
    :class="$style.component"
    :data-complete="isComplete"
    :hidden="isHidden"
  >
    <span :class="$style.bar" />
  </div>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'

  interface Props {
    isComplete?: boolean;
    visible: boolean;
  }

  const {
    isComplete,
    visible
  } = defineProps<Props>()

  const isHidden = computed(() => visible === false)
</script>

<style module>
  @keyframes progress {
    from {
      translate: -100% 0;
    }

    to {
      translate: 300% 0;
    }
  }

  .component {
    display: block;
    block-size: 2px;
    overflow: clip;
    opacity: 1;
    transition:
      display var(--transition-duration-fast),
      opacity var(--transition-duration-fast) var(--transition-easing-standard);
    transition-behavior: allow-discrete;

    &[hidden] {
      display: none;
      opacity: 0;
    }
  }

  @starting-style {
    .component {
      opacity: 0;
    }
  }

  .bar {
    display: block;
    inline-size: 34%;
    block-size: 100%;
    border-radius: var(--border-radius-pill);
    background-color: var(--color-accent-primary);
    animation: progress 1.1s ease-in-out infinite;
    transition: inline-size var(--transition-duration-fast) var(--transition-easing-standard);

    .component[data-complete="true"] & {
      inline-size: 100%;
      translate: 0;
      animation: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar {
      inline-size: 100%;
      opacity: 0.7;
      animation: none;
    }
  }
</style>
