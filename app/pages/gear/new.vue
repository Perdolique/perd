<template>
  <PageContent page-title="Add gear">
    <template #actions>
      <PerdLink to="/inventory">
        View inventory
      </PerdLink>

      <PerdLink to="/catalog">
        Browse catalog
      </PerdLink>
    </template>

    <div :class="$style.component">
      <p v-if="submittedItem" :class="$style.successMessage" role="status">
        Submitted
        <PerdLink :to="submittedItemPath">
          {{ submittedItem.name }}
        </PerdLink>
        for review. It is in your inventory now.
      </p>

      <EquipmentItemSubmissionForm
        form-id="gear-new-submission"
        :initial-brand-id="initialBrandId"
        :initial-category-id="initialCategoryId"
        :initial-name="initialName"
        show-optional-details
        submit-label="Submit item"
        variant="page"
        @submitted="handleSubmitted"
      />
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { definePageMeta, useRoute } from '#imports'
  import type { ItemSubmissionCreateResponse, SubmittedCatalogItem } from '~/types/equipment'
  import PerdLink from '~/components/PerdLink.vue'
  import EquipmentItemSubmissionForm from '~/components/equipment/EquipmentItemSubmissionForm.vue'
  import PageContent from '~/components/layout/PageContent.vue'

  definePageMeta({
    layout: 'page'
  })

  const route = useRoute()
  const submittedItem = ref<SubmittedCatalogItem | null>(null)

  function getQueryValue(value: unknown) {
    if (typeof value === 'string') {
      return value
    }

    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0]
    }

    return ''
  }

  const initialName = computed(() => getQueryValue(route.query.name))
  const initialBrandId = computed(() => getQueryValue(route.query.brandId))
  const initialCategoryId = computed(() => getQueryValue(route.query.categoryId))
  const submittedItemPath = computed(() => submittedItem.value === null ? '' : `/catalog/${submittedItem.value.id}`)

  function handleSubmitted(response: ItemSubmissionCreateResponse) {
    submittedItem.value = response.item
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-24);
  }

  .successMessage {
    margin: 0;
    inline-size: min(100%, 44rem);
    padding: var(--spacing-12);
    border: 1px solid var(--color-success-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-success-subtle);
    color: var(--color-text-primary);
  }
</style>
