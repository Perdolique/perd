<template>
  <button
    :class="$style.component"
    @click="onCardClick"
  >
    <div :class="$style.name">
      {{ name }}
    </div>

    <BrandInfo
      :equipment-count="equipmentCount"
      :website-url="websiteUrl"
    />
  </button>
</template>

<script lang="ts" setup>
  import type { BrandModel } from '~/models/brand';
  import BrandInfo from './BrandInfo.vue';

  interface Props extends BrandModel {}

  const { id } = defineProps<Props>()
  const router = useRouter()

  function onCardClick() {
    router.push(`/brands/details/${id}`)
  }
</script>

<style lang="scss" module>
  @mixin focusStyle {
    background-color: var(--accent-100);
    border-color: var(--accent-300);
  }

  .component {
    display: grid;
    outline: none;
    justify-content: space-between;
    text-align: left;
    row-gap: var(--spacing-24);
    background-color: var(--accent-50);
    border: 1px solid var(--accent-200);
    border-radius: var(--border-radius-8);
    padding: var(--spacing-16);
    transition:
      background-color var(--transition-time-quick) ease-out,
      border-color var(--transition-time-quick) ease-out;

    @media (hover: hover) {
      &:hover {
        @include focusStyle();
      }
    }

    &:focus-visible {
      @include focusStyle();
    }
  }

  .name {
    grid-area: 1 / 1 / 2 / 2;
    font-weight: var(--font-weight-medium);
  }
</style>
