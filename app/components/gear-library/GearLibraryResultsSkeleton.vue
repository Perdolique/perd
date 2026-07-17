<template>
  <div
    :class="$style.component"
    :data-visible="visible"
    data-testid="gear-library-results-skeleton"
    aria-hidden="true"
  >
    <div
      :class="$style.listShell"
      data-testid="gear-library-results-skeleton-row"
    >
      <div :class="$style.row">
        <span :class="$style.media" />

        <div :class="$style.identity">
          <span :class="$style.brand" />
          <span :class="$style.name" />
          <span :class="$style.category" />
        </div>

        <div :class="$style.properties">
          <div :class="$style.property">
            <span :class="$style.propertyName" />
            <span :class="$style.propertyValue" />
          </div>

          <div :class="$style.property">
            <span :class="$style.propertyName" />
            <span :class="$style.propertyValue" />
          </div>

          <div :class="$style.property">
            <span :class="$style.propertyName" />
            <span :class="$style.propertyValue" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    visible: boolean;
  }

  const {
    visible
  } = defineProps<Props>()
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
    container-type: inline-size;

    &[data-visible="false"] {
      opacity: 0;
    }
  }

  .media,
  .brand,
  .name,
  .category,
  .propertyName,
  .propertyValue {
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
  }

  .listShell {
    block-size: 8.75rem;
    overflow: clip;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-primary);

    @container (inline-size >= 44rem) {
      block-size: 6rem;
    }
  }

  .row {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    grid-template-areas:
      "media identity"
      "properties properties";
    align-items: start;
    gap: var(--spacing-12);
    block-size: 100%;
    padding: var(--spacing-12) var(--spacing-16);

    @container (inline-size >= 44rem) {
      grid-template-columns: 3rem minmax(10rem, 0.7fr) minmax(0, 1fr);
      grid-template-areas: "media identity properties";
      align-items: center;
    }
  }

  .media {
    grid-area: media;
    inline-size: 3rem;
    aspect-ratio: 1;
    border-radius: var(--border-radius-14);
  }

  .identity {
    grid-area: identity;
    display: grid;
    align-content: center;
    gap: var(--spacing-4);
  }

  .brand {
    inline-size: 30%;
    block-size: var(--font-size-12);
  }

  .name {
    inline-size: 72%;
    block-size: var(--font-size-17);
  }

  .category {
    inline-size: 48%;
    block-size: var(--font-size-14);
  }

  .properties {
    grid-area: properties;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: auto auto;
    align-items: start;
    row-gap: var(--spacing-4);
  }

  .property {
    display: grid;
    grid-row: span 2;
    grid-template-rows: subgrid;
    align-content: start;
    min-inline-size: 0;
    padding-inline: var(--spacing-12);
    border-inline-start: 1px solid var(--color-border-subtle);

    &:first-child {
      border-inline-start-width: 0;
    }

    @container (inline-size >= 44rem) {
      &:first-child {
        border-inline-start-width: 1px;
      }
    }
  }

  .propertyName {
    inline-size: 68%;
    block-size: var(--font-size-12);
  }

  .propertyValue {
    inline-size: 46%;
    block-size: var(--font-size-14);
  }

  @media (prefers-reduced-motion: reduce) {
    .media,
    .brand,
    .name,
    .category,
    .propertyName,
    .propertyValue {
      background: var(--color-surface-secondary);
      animation: none;
    }
  }
</style>
