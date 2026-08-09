<template>
  <PageContent page-title="Submit missing gear">
    <template v-if="showFormBackLink" #actions>
      <PerdLink :to="appRoutes.gearLibrary">
        Back to Gear library
      </PerdLink>
    </template>

    <PagePlaceholder
      v-if="isGuest"
      emoji="🔐"
      title="Account required."
    >
      Guest accounts cannot submit gear for review. Account upgrade options will be available later.
    </PagePlaceholder>

    <div v-else :class="$style.component">
      <div v-if="isSubmitted" :class="$style.confirmation">
        <p
          ref="confirmationStatus"
          role="status"
          tabindex="-1"
        >
          Submitted for review. It will not appear in Gear library, My gear, or packing lists until an administrator approves it.
        </p>

        <div :class="$style.actions">
          <PerdButton @click="startAnotherSubmission">
            Submit another item
          </PerdButton>

          <PerdLink :to="appRoutes.gearLibrary">
            Back to Gear library
          </PerdLink>
        </div>
      </div>

      <form v-else :class="$style.form" @submit.prevent="handleSubmit">
        <div
          v-if="hasMandatoryReferenceError"
          :class="$style.alert"
          role="alert"
        >
          <span>Could not load brands and categories.</span>

          <PerdButton
            size="small"
            variant="secondary"
            :loading="isMandatoryReferenceLoading"
            @click="retryMandatoryReferences"
          >
            Retry
          </PerdButton>
        </div>

        <div :class="$style.baseFields" :aria-busy="mandatoryAriaBusy">
          <TextInput
            ref="itemNameInput"
            v-model="itemName"
            label="Item name"
            name="name"
            placeholder="PocketRocket Deluxe"
            :disabled="isSubmitting"
            :maxlength="maxItemNameLength"
            required
          />

          <PerdSelect
            v-model="selectedBrandId"
            label="Brand"
            :options="brandOptions"
            :disabled="isMandatorySelectDisabled"
            :pending="isMandatoryReferenceLoading"
            required
          />

          <PerdSelect
            v-model="selectedCategorySlug"
            label="Category"
            :options="categoryOptions"
            :disabled="isMandatorySelectDisabled"
            :pending="isMandatoryReferenceLoading"
            required
          />
        </div>

        <section
          v-if="hasSelectedCategory"
          :class="$style.properties"
          :aria-labelledby="knownPropertiesTitleId"
        >
          <div :class="$style.sectionHeading">
            <h2 :id="knownPropertiesTitleId" :class="$style.heading">
              Known characteristics
            </h2>

            <span v-if="isCategoryDetailLoading" :class="$style.muted" role="status">
              Loading characteristics…
            </span>
          </div>

          <div
            v-if="hasCategoryDetailError"
            :class="$style.alert"
            role="alert"
          >
            <span>Could not load characteristics. You can still submit the basic item.</span>

            <PerdButton
              size="small"
              variant="secondary"
              :loading="isCategoryDetailLoading"
              @click="retryCategoryDetail"
            >
              Retry
            </PerdButton>
          </div>

          <div v-else-if="hasPropertyFields" :class="$style.propertyFields">
            <template v-for="property in propertyFields" :key="property.id">
              <TextInput
                v-if="property.isText"
                :model-value="property.value"
                :label="property.label"
                :disabled="isSubmitting"
                :name="property.inputName"
                @update:model-value="property.setValue"
              />

              <NumberInput
                v-else-if="property.isNumber"
                :model-value="property.value"
                :label="property.label"
                :disabled="isSubmitting"
                :error="property.error"
                :name="property.inputName"
                :unit="property.unit"
                @update:model-value="property.setValue"
              />

              <PerdSelect
                v-else-if="property.isEnum"
                :model-value="property.value"
                :label="property.label"
                :options="property.enumOptions"
                :disabled="isSubmitting"
                @update:model-value="property.setValue"
              />

              <PerdSelect
                v-else
                :model-value="property.value"
                :label="property.label"
                :options="booleanOptions"
                :disabled="isSubmitting"
                @update:model-value="property.setValue"
              />
            </template>
          </div>

          <p v-else-if="showNoPropertiesMessage" :class="$style.muted">
            This category has no characteristics yet.
          </p>
        </section>

        <p v-if="hasSubmitError" :class="$style.errorMessage" role="alert">
          Could not submit item. Try again.
        </p>

        <div :class="$style.actions">
          <PerdButton
            type="submit"
            :disabled="isSubmitDisabled"
            :loading="isSubmitting"
          >
            Submit for review
          </PerdButton>
        </div>
      </form>
    </div>
  </PageContent>
</template>

<script lang="ts" setup>
  /* oxlint-disable max-lines -- The single submission page owns its one-off form, request, and field state. */
  import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
  import { definePageMeta, useFetch, useRequestFetch, useUserStore } from '#imports'
  import { limits } from '#shared/constants'
  import { isFiniteDecimalNumber } from '#shared/utils/decimal-number'
  import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
  import { appRoutes } from '~/utils/navigation'
  import NumberInput from '~/components/NumberInput.vue'
  import PagePlaceholder from '~/components/PagePlaceholder.vue'
  import PageContent from '~/components/layout/PageContent.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import PerdSelect, { type PerdSelectOption } from '~/components/perd-select/PerdSelect.vue'
  import TextInput from '~/components/TextInput.vue'

  interface ItemSubmissionPropertyInput {
    propertyId: number;
    value: boolean | string;
  }

  interface ItemSubmissionCreateBody {
    brandId: number;
    categoryId: number;
    name: string;
    properties: ItemSubmissionPropertyInput[];
  }

  interface PropertyFieldView {
    enumOptions: PerdSelectOption[];
    error?: string;
    id: number;
    inputName: string;
    isEnum: boolean;
    isNumber: boolean;
    isText: boolean;
    label: string;
    setValue: (value: string) => void;
    unit: string | null;
    value: string;
  }

  definePageMeta({
    layout: 'page'
  })

  const requestFetch = useRequestFetch()
  const { user } = useUserStore()
  const isGuest = computed(() => user.value.isGuest)
  const knownPropertiesTitleId = useId()
  const confirmationStatus = useTemplateRef('confirmationStatus')
  const itemNameInput = useTemplateRef('itemNameInput')
  const maxItemNameLength = limits.maxEquipmentItemNameLength
  const itemName = ref('')
  const selectedBrandId = ref('')
  const selectedCategorySlug = ref('')
  const categoryDetail = ref<CategoryDetailResponse | null>(null)
  const categoryDetailError = ref(false)
  const isCategoryDetailLoading = ref(false)
  const isSubmitting = ref(false)
  const isSubmitted = ref(false)
  const submitError = ref(false)
  const propertyValues = ref<Record<number, unknown>>({})
  const propertyErrors = ref<Record<number, boolean>>({})
  let categoryRequestController: InstanceType<typeof globalThis.AbortController> | null = null
  let categoryRequestSequence = 0

  const brandsRequestPromise = useFetch('/api/equipment/brands', {
    default: () => [],
    immediate: isGuest.value === false,
    key: 'item-submission-brands'
  })

  const categoriesRequestPromise = useFetch('/api/equipment/categories', {
    default: () => [],
    immediate: isGuest.value === false,
    key: 'item-submission-categories'
  })

  const [brandsRequest, categoriesRequest] = await Promise.all([
    brandsRequestPromise,
    categoriesRequestPromise
  ])

  const {
    data: brandsResponse,
    error: brandsError,
    refresh: refreshBrands,
    status: brandsStatus
  } = brandsRequest

  const {
    data: categoriesResponse,
    error: categoriesError,
    refresh: refreshCategories,
    status: categoriesStatus
  } = categoriesRequest

  const booleanOptions = [
    {
      label: 'Not specified',
      value: ''
    },
    {
      label: 'Yes',
      value: 'true'
    },
    {
      label: 'No',
      value: 'false'
    }
  ]

  const brandOptions = computed<PerdSelectOption[]>(() => {
    const options = brandsResponse.value.map((brand) => {
      return {
        label: brand.name,
        value: `${brand.id}`
      }
    })

    const defaultOption = {
      label: 'Select a brand',
      value: ''
    }

    return [
      defaultOption,
      ...options
    ]
  })

  const categoryOptions = computed<PerdSelectOption[]>(() => {
    const options = categoriesResponse.value.map((category) => {
      return {
        label: category.name,
        value: category.slug
      }
    })

    const defaultOption = {
      label: 'Select a category',
      value: ''
    }

    return [
      defaultOption,
      ...options
    ]
  })

  const hasMandatoryReferenceError = computed(() => (
    brandsError.value !== undefined || categoriesError.value !== undefined
  ))

  const isMandatoryReferenceLoading = computed(() => (
    brandsStatus.value === 'pending' || categoriesStatus.value === 'pending'
  ))

  const isMandatoryReferenceReady = computed(() => (
    brandsStatus.value === 'success' && categoriesStatus.value === 'success'
  ))

  const isMandatorySelectDisabled = computed(() => (
    isSubmitting.value || isMandatoryReferenceReady.value === false
  ))

  const mandatoryAriaBusy = computed(() => isMandatoryReferenceLoading.value || undefined)
  const hasSelectedCategory = computed(() => selectedCategorySlug.value !== '')
  const hasCategoryDetailError = computed(() => categoryDetailError.value)

  const selectedBrand = computed(() => {
    const brandId = Number(selectedBrandId.value)
    const brands = brandsResponse.value

    return brands.find((brand) => brand.id === brandId)
  })

  const selectedCategory = computed(() => {
    const categories = categoriesResponse.value

    return categories.find((category) => category.slug === selectedCategorySlug.value)
  })

  function getPropertyFieldValue(rawValue: unknown) {
    if (typeof rawValue === 'string') {
      return rawValue
    }

    if (typeof rawValue === 'number') {
      const isFiniteNumber = Number.isFinite(rawValue)

      if (isFiniteNumber === false) {
        return ''
      }

      return `${rawValue}`
    }

    if (typeof rawValue === 'boolean') {
      if (rawValue) {
        return 'true'
      }

      return 'false'
    }

    return ''
  }

  const propertyFields = computed<PropertyFieldView[]>(() => {
    const properties = categoryDetail.value?.properties ?? []

    return properties.map((property) => {
      const propertyEnumOptions = property.enumOptions ?? []

      const mappedEnumOptions = propertyEnumOptions.map((option) => {
        return {
          label: option.name,
          value: option.slug
        }
      })

      const enumOptions = [
        {
          label: 'Not specified',
          value: ''
        },
        ...mappedEnumOptions
      ]

      const rawValue = propertyValues.value[property.id]
      const value = getPropertyFieldValue(rawValue)
      const hasError = propertyErrors.value[property.id] === true
      const error = hasError ? 'Enter a valid decimal number.' : undefined

      function setValue(nextValue: string) {
        propertyValues.value[property.id] = nextValue
      }

      return {
        enumOptions,
        error,
        id: property.id,
        inputName: `property-${property.id}`,
        isEnum: property.dataType === 'enum',
        isNumber: property.dataType === 'number',
        isText: property.dataType === 'text',
        label: property.name,
        setValue,
        unit: property.unit,
        value
      }
    })
  })

  const hasPropertyFields = computed(() => propertyFields.value.length > 0)

  const showNoPropertiesMessage = computed(() => (
    isCategoryDetailLoading.value === false
    && categoryDetailError.value === false
    && categoryDetail.value !== null
  ))

  const hasSubmitError = computed(() => submitError.value)
  const showFormBackLink = computed(() => isGuest.value || isSubmitted.value === false)
  const trimmedItemName = computed(() => itemName.value.trim())

  const isSubmitDisabled = computed(() => (
    trimmedItemName.value === ''
    || selectedBrand.value === undefined
    || selectedCategory.value === undefined
    || isMandatoryReferenceReady.value === false
    || isSubmitting.value
  ))

  function clearPropertyState() {
    propertyValues.value = {}
    propertyErrors.value = {}
  }

  async function startAnotherSubmission() {
    itemName.value = ''
    selectedBrandId.value = ''
    selectedCategorySlug.value = ''
    categoryDetail.value = null
    categoryDetailError.value = false
    submitError.value = false

    clearPropertyState()

    isSubmitted.value = false

    await nextTick()

    itemNameInput.value?.focus()
  }

  async function loadCategoryDetail(categorySlug: string) {
    categoryRequestController?.abort()
    categoryRequestSequence += 1

    const requestSequence = categoryRequestSequence

    clearPropertyState()

    categoryDetail.value = null
    categoryDetailError.value = false

    if (categorySlug === '') {
      isCategoryDetailLoading.value = false

      return
    }

    const controller = new globalThis.AbortController()

    categoryRequestController = controller
    isCategoryDetailLoading.value = true

    try {
      const categoryDetailPath = `/api/equipment/categories/by-slug/${categorySlug}` as const

      const response = await requestFetch(categoryDetailPath, {
        signal: controller.signal
      })

      const isCurrentRequest = requestSequence === categoryRequestSequence

      if (isCurrentRequest) {
        categoryDetail.value = response
      }
    } catch {
      const isCurrentRequest = requestSequence === categoryRequestSequence

      if (controller.signal.aborted === false && isCurrentRequest) {
        categoryDetailError.value = true
      }
    } finally {
      const isCurrentRequest = requestSequence === categoryRequestSequence

      if (isCurrentRequest) {
        isCategoryDetailLoading.value = false
      }
    }
  }

  async function retryMandatoryReferences() {
    const refreshBrandsPromise = refreshBrands()
    const refreshCategoriesPromise = refreshCategories()

    await Promise.all([
      refreshBrandsPromise,
      refreshCategoriesPromise
    ])
  }

  async function retryCategoryDetail() {
    await loadCategoryDetail(selectedCategorySlug.value)
  }

  function createSubmissionProperties() {
    const properties: ItemSubmissionPropertyInput[] = []
    const categoryProperties = categoryDetail.value?.properties ?? []
    let hasValidationError = false

    for (const property of categoryProperties) {
      const rawValue = propertyValues.value[property.id]
      const fieldValue = getPropertyFieldValue(rawValue)
      const trimmedValue = fieldValue.trim()
      const hasValue = trimmedValue !== ''
      const isNumberProperty = property.dataType === 'number'

      propertyErrors.value[property.id] = false

      if (hasValue && isNumberProperty) {
        const hasValidNumber = isFiniteDecimalNumber(trimmedValue)

        if (hasValidNumber === false) {
          propertyErrors.value[property.id] = true
          hasValidationError = true
        }
      }

      const hasPropertyError = propertyErrors.value[property.id] === true
      const isPropertyValid = hasValue && hasPropertyError === false

      if (isPropertyValid) {
        const isBooleanProperty = property.dataType === 'boolean'
        let value: boolean | string = trimmedValue

        if (isBooleanProperty) {
          value = trimmedValue === 'true'
        }

        properties.push({
          propertyId: property.id,
          value
        })
      }
    }

    return {
      hasValidationError,
      properties
    }
  }

  async function handleSubmit() {
    if (isSubmitDisabled.value) {
      return
    }

    const brand = selectedBrand.value
    const category = selectedCategory.value

    if (brand === undefined || category === undefined) {
      return
    }

    const submissionProperties = createSubmissionProperties()

    if (submissionProperties.hasValidationError) {
      return
    }

    const body: ItemSubmissionCreateBody = {
      brandId: brand.id,
      categoryId: category.id,
      name: trimmedItemName.value,
      properties: submissionProperties.properties
    }

    submitError.value = false
    isSubmitting.value = true

    try {
      await requestFetch('/api/equipment/item-submissions', {
        body,
        method: 'POST'
      })

      isSubmitted.value = true

      await nextTick()

      confirmationStatus.value?.focus()
    } catch {
      submitError.value = true
    } finally {
      isSubmitting.value = false
    }
  }

  watch(selectedCategorySlug, (categorySlug) => {
    void loadCategoryDetail(categorySlug)
  })

  onBeforeUnmount(() => {
    categoryRequestController?.abort()
  })
</script>

<style module>
  .component {
    display: grid;
    container-type: inline-size;
  }

  .form {
    display: grid;
    gap: var(--spacing-24);
    max-inline-size: 54rem;
  }

  .baseFields {
    display: grid;
    gap: var(--spacing-16);

    @container (inline-size >= 42rem) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .properties,
  .propertyFields {
    display: grid;
    gap: var(--spacing-16);
  }

  .sectionHeading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--spacing-8);
  }

  .heading {
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
  }

  .alert {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-12);
    padding: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background-color: var(--color-surface-secondary);
  }

  .errorMessage {
    color: var(--color-danger-primary);
  }

  .muted {
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-start;
    gap: var(--spacing-12);
  }

  .confirmation {
    display: grid;
    gap: var(--spacing-16);
    max-inline-size: 44rem;
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
  }
</style>
