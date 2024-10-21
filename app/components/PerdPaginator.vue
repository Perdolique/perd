<template>
  <div :class="$style.component">
    <button
      v-for="page in pagesCount"
      :key="page"
      :class="[$style.button, { active: isActivePage(page) }]"
      @click="handlePageClick(page)"
    >
      {{ page }}
    </button>
  </div>
</template>

<script lang="ts" setup>
  interface Props {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
  }

  type Emits = (event: 'page-change', page: number) => void

  const { limit, total, offset } = defineProps<Props>();
  const emit = defineEmits<Emits>();
  const pagesCount = computed(() => Math.ceil(total / limit));
  const current = computed(() => Math.floor(offset / limit) + 1);

  function isActivePage(page: number): boolean {
    return page === current.value;
  }

  function handlePageClick(page: number): void {
    if (page !== current.value) {
      emit('page-change', page);
    }
  }
</script>

<style lang="scss" module>
  .component {
    display: flex;
    justify-content: center;
    column-gap: var(--spacing-4);
  }

  .button {
    height: 2rem;
    width: 2rem;
    color: var(--text-600);
    background-color: var(--secondary-50);
    border-radius: var(--border-radius-8);
    border: 1px solid var(--secondary-300);
    outline: none;
    transition:
      color var(--transition-time-quick),
      background-color var(--transition-time-quick),
      border-color var(--transition-time-quick),
      scale var(--transition-time-quick);

    @mixin hoverStyle {
      color: var(--text-800);
      background-color: var(--secondary-100);
      border-color: var(--secondary-400);
      scale: 1.2;
    }

    @media (hover: hover) {
      &:hover:not:global(.active) {
        @include hoverStyle;
      }
    }

    &:focus-visible {
      @include hoverStyle;
    }

    &:global(.active),
    &:active {
      color: var(--text-900);
      background-color: var(--secondary-200);
      cursor: default;
    }
  }
</style>
