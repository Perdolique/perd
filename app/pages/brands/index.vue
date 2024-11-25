
<template>
  <PageContent page-title="Brands">
    <template #actions>
      <PerdButton
        small
        icon="tabler:plus"
        @click="onAddBrandClick"
      >
        Add brand
      </PerdButton>
    </template>

    <EmptyState
      v-if="noResults"
      icon="streamline-emojis:man-shrugging-2"
    >
      No results found
    </EmptyState>

    <div
      v-else
      :class="$style.content"
    >
      <PerdPaginator
        :class="$style.paginator"
        :limit="meta.limit"
        :offset="meta.offset"
        :total="meta.total"
        @page-change="handlePageChange"
      />

      <BrandsTable :brands="brands" />
      <BrandCards :brands="brands" />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import EmptyState from '~/components/EmptyState.vue'
  import BrandsTable from '~/components/brands/BrandsTable.vue';
  import PerdPaginator from '~/components/PerdPaginator.vue'
  import BrandCards from '~/components/brands/BrandCards.vue';

  definePageMeta({
    layout: 'page'
  })

  const router = useRouter()
  const { brands, meta, page } = await useBrands()
  const noResults = computed(() => brands.value.length === 0)

  function onAddBrandClick() {
    router.push('/brands/add')
  }

  function handlePageChange(newPage: number) {
    page.value = newPage
  }
</script>

<style module>
  .content {
    display: grid;
    row-gap: var(--spacing-12);
  }

  .paginator {
    justify-self: end;
  }
</style>
