<template>
  <div :class="$style.component">
    <button
      v-for="page in visiblePages"
      :key="page"
      :class="[$style.button, { active: isActivePage(page) }]"
      @click="handlePageClick(page)"
      :disabled="isPageDisabled(page)"
    >
      {{ page }}
    </button>
  </div>
</template>

<script lang="ts">
  const VISIBLE_PAGES = 7;
</script>

<script lang="ts" setup>
  interface Props {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
  }

  type Emits = (event: 'page-change', page: number) => void
  type Page = number | '...'

  const { limit, total, offset } = defineProps<Props>();
  const emit = defineEmits<Emits>();
  const pagesCount = computed(() => Math.ceil(total / limit));
  const current = computed(() => Math.floor(offset / limit) + 1);

  const visiblePages = computed(() => {
    if (pagesCount.value <= VISIBLE_PAGES) {
      return Array.from({ length: pagesCount.value }, (_, index) => index + 1);
    }

    const pages : Page[] = [];
    const halfVisible = Math.floor(VISIBLE_PAGES / 2);

    if (current.value <= halfVisible + 1) {
      // Start of list
      for (let i = 1; i <= VISIBLE_PAGES - 2; i++) {
        pages.push(i);
      }

      pages.push('...');
      pages.push(pagesCount.value);
    } else if (current.value >= pagesCount.value - halfVisible) {
      // End of list
      pages.push(1);
      pages.push('...');

      for (let i = pagesCount.value - (VISIBLE_PAGES - 3); i <= pagesCount.value; i++) {
        pages.push(i);
      }
    } else {
      // Middle of list
      pages.push(1);
      pages.push('...');

      for (let i = current.value - 1; i <= current.value + 1; i++) {
        pages.push(i);
      }

      pages.push('...');
      pages.push(pagesCount.value);
    }

    return pages;
  });

  function isActivePage(page: Page) : boolean {
    return page === current.value;
  }

  function isPageDisabled(page: Page) : boolean {
    return page === '...';
  }

  function handlePageClick(page: Page) : void {
    if (
      page !== '...' &&
      page > 0 &&
      page <= pagesCount.value &&
      page !== current.value
    ) {
      emit('page-change', page);
    }
  }
</script>

<style lang="scss" module>
  @mixin hoverStyle {
    color: var(--text-800);
    background-color: var(--secondary-100);
    border-color: var(--secondary-400);
    scale: 1.2;
  }

  .component {
    display: flex;
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

    @media (hover: hover) {
      &:hover:not(:global(.active)) {
        @include hoverStyle();
      }
    }

    &:focus-visible {
      @include hoverStyle();
    }

    &:global(.active),
    &:active {
      color: var(--text-900);
      background-color: var(--secondary-200);
      cursor: default;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
  }
</style>
