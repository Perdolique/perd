<template>
  <form
    ref="formRef"
    :class="[$style.component, variant]"
    action="/api/equipment/item-submissions"
    method="post"
    @submit.prevent="handleSubmit"
  >
    <div v-if="showHeader" :class="$style.header">
      <div :class="$style.headingBlock">
        <div :class="$style.kicker">
          Gear submission
        </div>

        <PerdHeading
          :id="headingId"
          :class="$style.heading"
          :level="2"
        >
          Add gear
        </PerdHeading>
      </div>

      <button
        v-if="showCloseButton"
        type="button"
        :class="$style.closeButton"
        :disabled="isSubmitting"
        aria-label="Close gear submission dialog"
        @click="emitClose"
      >
        <Icon name="tabler:x" aria-hidden="true" />
      </button>
    </div>

    <p :class="$style.description">
      The item goes into your inventory now. It appears in the public catalog after review.
    </p>

    <p v-if="isReferenceLoading" :class="$style.helperMessage" role="status">
      Loading catalog options.
    </p>

    <div v-else-if="hasReferenceError" :class="$style.errorPanel" role="alert">
      <p :class="$style.errorMessage">
        Could not load catalog options.
      </p>

      <PerdButton variant="secondary" size="small" @click="loadReferenceData">
        Retry
      </PerdButton>
    </div>

    <div v-else :class="$style.fields">
      <div :class="$style.field">
        <label :class="$style.inputLabel" :for="nameInputId">
          Item name
        </label>

        <input
          :id="nameInputId"
          ref="nameInput"
          v-model="itemName"
          :class="$style.input"
          :disabled="isSubmitting"
          :maxlength="limits.maxEquipmentItemNameLength"
          name="name"
          autocomplete="off"
          required
        >
      </div>

      <div :class="$style.field">
        <label :class="$style.inputLabel" :for="brandInputId">
          Brand
        </label>

        <select
          :id="brandInputId"
          v-model="selectedBrandId"
          :class="$style.input"
          :disabled="isSubmitting"
          name="brandId"
          required
        >
          <option value="">
            Select a brand
          </option>

          <option
            v-for="brand in brandOptionViews"
            :key="brand.id"
            :value="brand.value"
          >
            {{ brand.name }}
          </option>
        </select>
      </div>

      <div :class="$style.field">
        <label :class="$style.inputLabel" :for="categoryInputId">
          Category
        </label>

        <select
          :id="categoryInputId"
          v-model="selectedCategoryId"
          :class="$style.input"
          :disabled="isSubmitting"
          name="categoryId"
          required
        >
          <option value="">
            Select a category
          </option>

          <option
            v-for="category in categoryOptionViews"
            :key="category.id"
            :value="category.value"
          >
            {{ category.name }}
          </option>
        </select>
      </div>

      <fieldset v-if="showPropertyFields" :class="$style.fieldset">
        <legend :class="$style.legend">
          Optional details
        </legend>

        <p v-if="isCategoryLoading" :class="$style.helperMessage" role="status">
          Loading category details.
        </p>

        <div v-else-if="hasCategoryError" :class="$style.errorPanel" role="status">
          <p :class="$style.helperMessage">
            Optional category details are unavailable. You can still submit the item.
          </p>

          <PerdButton variant="secondary" size="small" :disabled="isSubmitting" @click="loadCategoryDetail">
            Retry
          </PerdButton>
        </div>

        <div v-else :class="$style.propertyFields">
          <div
            v-for="property in propertyFields"
            :key="property.id"
            :class="$style.field"
          >
            <label :class="$style.inputLabel" :for="property.inputId">
              {{ property.name }}
            </label>

            <input
              v-if="property.isText"
              :id="property.inputId"
              v-model="propertyValues[property.valueKey]"
              :class="$style.input"
              :disabled="isSubmitting"
              :name="property.valueName"
              autocomplete="off"
            >

            <input
              v-else-if="property.isNumber"
              :id="property.inputId"
              v-model="propertyValues[property.valueKey]"
              :class="$style.input"
              :disabled="isSubmitting"
              :name="property.valueName"
              :aria-describedby="property.hintId"
              inputmode="decimal"
              :pattern="numberInputPattern"
              autocomplete="off"
            >

            <select
              v-else-if="property.isEnum"
              :id="property.inputId"
              v-model="propertyValues[property.valueKey]"
              :class="$style.input"
              :disabled="isSubmitting"
              :name="property.valueName"
            >
              <option value="">
                Not set
              </option>

              <option
                v-for="option in property.enumOptions"
                :key="option.id"
                :value="option.slug"
              >
                {{ option.name }}
              </option>
            </select>

            <input
              v-else-if="property.isBoolean"
              :id="property.inputId"
              v-model="propertyValues[property.valueKey]"
              :class="$style.checkbox"
              :disabled="isSubmitting"
              :name="property.valueName"
              false-value="false"
              true-value="true"
              type="checkbox"
            >

            <p v-if="property.showHint" :id="property.hintId" :class="$style.hint">
              Use {{ property.unit }}.
            </p>
          </div>
        </div>
      </fieldset>
    </div>

    <p v-if="isSubmitErrorVisible" :class="$style.errorMessage" role="alert">
      {{ submitErrorMessage }}
    </p>

    <div :class="$style.actions">
      <PerdButton
        v-if="showCancelButton"
        variant="secondary"
        :disabled="isSubmitting"
        @click="emitClose"
      >
        Cancel
      </PerdButton>

      <PerdLink v-if="showFullPageLink" :to="fullPageLocation">
        Add details on full page
      </PerdLink>

      <PerdButton
        type="submit"
        icon="tabler:plus"
        :loading="isSubmitting"
        :disabled="isSubmitDisabled"
      >
        {{ submitLabel }}
      </PerdButton>
    </div>
  </form>
</template>

<script lang="ts" setup>
  import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
  import { useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'
  import type {
    CatalogEntityDetail,
    CategoryDetailResponse,
    CategoryPropertyEnumOption,
    ItemSubmissionCreateBody,
    ItemSubmissionCreateResponse,
    ItemSubmissionPropertyInput
  } from '~/types/equipment'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdHeading from '~/components/PerdHeading.vue'
  import PerdLink from '~/components/PerdLink.vue'

  interface PropertyFieldView {
    enumOptions: CategoryPropertyEnumOption[];
    hintId: string;
    id: number;
    inputId: string;
    isBoolean: boolean;
    isEnum: boolean;
    isNumber: boolean;
    isText: boolean;
    name: string;
    showHint: boolean;
    unit: string;
    valueKey: string;
    valueName: string;
  }

  interface ReferenceOptionView extends CatalogEntityDetail {
    value: string;
  }

  interface Props {
    active?: boolean;
    formId: string;
    headingId?: string;
    initialBrandId?: string;
    initialCategoryId?: string;
    initialName?: string;
    showCancelButton?: boolean;
    showCloseButton?: boolean;
    showFullPageLink?: boolean;
    showHeader?: boolean;
    showOptionalDetails?: boolean;
    submitLabel?: string;
    variant?: 'dialog' | 'page';
  }

  interface Emits {
    (event: 'close'): void;
    (event: 'submitted', response: ItemSubmissionCreateResponse): void;
    (event: 'submitting', isSubmitting: boolean): void;
  }

  const {
    active = true,
    formId,
    headingId,
    initialBrandId = '',
    initialCategoryId = '',
    initialName = '',
    showCancelButton = false,
    showCloseButton = false,
    showFullPageLink = false,
    showHeader = false,
    showOptionalDetails = false,
    submitLabel = 'Submit item',
    variant = 'page'
  } = defineProps<Props>()

  const emit = defineEmits<Emits>()
  const $fetch = useRequestFetch()
  const formRef = useTemplateRef('formRef')
  const nameInput = useTemplateRef('nameInput')

  const brandOptions = ref<CatalogEntityDetail[]>([])
  const categoryOptions = ref<CatalogEntityDetail[]>([])
  const categoryDetail = ref<CategoryDetailResponse | null>(null)
  const itemName = ref('')
  const propertyValues = ref<Record<string, string>>({})
  const referenceStatus = ref<'error' | 'idle' | 'loaded' | 'loading'>('idle')
  const categoryStatus = ref<'error' | 'idle' | 'loaded' | 'loading'>('idle')
  const numberInputPattern = String.raw`-?[0-9]+(\.[0-9]+)?`
  const selectedBrandId = ref('')
  const selectedCategoryId = ref('')
  const submitErrorMessage = ref<string | null>(null)
  const isSubmitting = ref(false)
  let categoryRequestId = 0

  const nameInputId = computed(() => `${formId}-name`)
  const brandInputId = computed(() => `${formId}-brand`)
  const categoryInputId = computed(() => `${formId}-category`)
  const isReferenceLoading = computed(() => referenceStatus.value === 'loading')
  const hasReferenceError = computed(() => referenceStatus.value === 'error')
  const isCategoryLoading = computed(() => categoryStatus.value === 'loading')
  const hasCategoryError = computed(() => categoryStatus.value === 'error')
  const isSubmitErrorVisible = computed(() => submitErrorMessage.value !== null)

  function createReferenceOptionView(option: CatalogEntityDetail): ReferenceOptionView {
    return {
      id: option.id,
      name: option.name,
      slug: option.slug,
      value: `${option.id}`
    }
  }

  const brandOptionViews = computed<ReferenceOptionView[]>(() => brandOptions.value.map(createReferenceOptionView))
  const categoryOptionViews = computed<ReferenceOptionView[]>(() => categoryOptions.value.map(createReferenceOptionView))
  const selectedCategory = computed(() => categoryOptionViews.value.find((category) => category.value === selectedCategoryId.value))
  const showPropertyFields = computed(() => showOptionalDetails && selectedCategoryId.value !== '')
  const propertyFields = computed<PropertyFieldView[]>(() => {
    const properties = categoryDetail.value?.properties ?? []

    return properties.map((property) => {
      const enumOptions = property.enumOptions ?? []
      const unit = property.unit ?? ''

      return {
        enumOptions,
        hintId: `${formId}-property-${property.id}-hint`,
        id: property.id,
        inputId: `${formId}-property-${property.id}`,
        isBoolean: property.dataType === 'boolean',
        isEnum: property.dataType === 'enum',
        isNumber: property.dataType === 'number',
        isText: property.dataType === 'text',
        name: property.name,
        showHint: property.dataType === 'number' && unit !== '',
        unit,
        valueKey: `${property.id}`,
        valueName: `property-${property.id}`
      }
    })
  })
  const isBaseFormIncomplete = computed(() => {
    const trimmedName = itemName.value.trim()

    return trimmedName === '' || selectedBrandId.value === '' || selectedCategoryId.value === ''
  })
  const isSubmitDisabled = computed(() => (
    isSubmitting.value || isReferenceLoading.value || hasReferenceError.value || isBaseFormIncomplete.value
  ))
  const fullPageLocation = computed(() => {
    const query: Record<string, string> = {}
    const name = itemName.value.trim()

    if (name !== '') {
      query.name = name
    }

    if (selectedBrandId.value !== '') {
      query.brandId = selectedBrandId.value
    }

    if (selectedCategoryId.value !== '') {
      query.categoryId = selectedCategoryId.value
    }

    return {
      path: '/gear/new',
      query
    }
  })

  function resetForm() {
    categoryDetail.value = null
    categoryStatus.value = 'idle'
    itemName.value = initialName
    propertyValues.value = {}
    selectedBrandId.value = initialBrandId
    selectedCategoryId.value = initialCategoryId
    submitErrorMessage.value = null
  }

  function resetNativeFormState() {
    formRef.value?.reset()
  }

  async function loadReferenceData() {
    if (referenceStatus.value === 'loaded') {
      return
    }

    referenceStatus.value = 'loading'

    try {
      const brandsPromise = $fetch('/api/equipment/brands')
      const categoriesPromise = $fetch('/api/equipment/categories')
      const [brandsResponse, categoriesResponse] = await Promise.all([
        brandsPromise,
        categoriesPromise
      ])

      brandOptions.value = brandsResponse
      categoryOptions.value = categoriesResponse
      referenceStatus.value = 'loaded'
    } catch {
      referenceStatus.value = 'error'
    }
  }

  async function loadCategoryDetail() {
    const category = selectedCategory.value

    if (showOptionalDetails === false || category === undefined) {
      categoryStatus.value = 'idle'

      return
    }

    const requestId = categoryRequestId + 1
    categoryRequestId = requestId
    categoryStatus.value = 'loading'

    try {
      const detail = await $fetch<CategoryDetailResponse>(`/api/equipment/categories/${category.slug}`)
      const isCurrentRequest = requestId === categoryRequestId

      if (isCurrentRequest) {
        categoryDetail.value = detail
        categoryStatus.value = 'loaded'
      }
    } catch {
      const isCurrentRequest = requestId === categoryRequestId

      if (isCurrentRequest) {
        categoryStatus.value = 'error'
      }
    }
  }

  function createSubmittedProperties(): ItemSubmissionPropertyInput[] {
    const submittedProperties: ItemSubmissionPropertyInput[] = []

    if (showOptionalDetails === false) {
      return submittedProperties
    }

    for (const property of propertyFields.value) {
      const rawValue = propertyValues.value[property.valueKey] ?? ''

      if (rawValue !== '') {
        const value = property.isBoolean
          ? rawValue === 'true'
          : rawValue.trim()

        if (value !== '') {
          submittedProperties.push({
            propertyId: property.id,
            value
          })
        }
      }
    }

    return submittedProperties
  }

  function createSubmissionBody(): ItemSubmissionCreateBody {
    const brandId = Number(selectedBrandId.value)
    const categoryId = Number(selectedCategoryId.value)
    const properties = createSubmittedProperties()

    return {
      brandId,
      categoryId,
      name: itemName.value.trim(),
      properties
    }
  }

  function emitClose() {
    if (isSubmitting.value) {
      return
    }

    emit('close')
  }

  async function handleSubmit() {
    if (isSubmitDisabled.value) {
      return
    }

    submitErrorMessage.value = null
    isSubmitting.value = true
    emit('submitting', true)

    try {
      const body = createSubmissionBody()
      const response = await $fetch('/api/equipment/item-submissions', {
        method: 'POST',
        body
      })

      emit('submitted', response)
    } catch {
      submitErrorMessage.value = 'Could not submit item.'
    } finally {
      isSubmitting.value = false
      emit('submitting', false)
    }
  }

  watch(() => active, async (isActive) => {
    if (isActive === false) {
      return
    }

    resetNativeFormState()
    resetForm()
    await loadReferenceData()

    if (selectedCategoryId.value !== '' && showOptionalDetails) {
      await loadCategoryDetail()
    }

    await nextTick()
    nameInput.value?.focus()
  }, {
    immediate: true
  })

  watch(selectedCategoryId, async () => {
    propertyValues.value = {}
    categoryDetail.value = null

    if (selectedCategoryId.value === '' || active === false || showOptionalDetails === false) {
      categoryStatus.value = 'idle'

      return
    }

    await loadCategoryDetail()
  })
</script>

<style module>
  .component {
    display: grid;
    row-gap: var(--spacing-20);
    padding: var(--spacing-24);
    border: 1px solid var(--color-border-subtle);
    background:
      linear-gradient(180deg, var(--color-surface-primary), var(--color-surface-secondary));
  }

  .component:global(.dialog) {
    inline-size: min(100vw - var(--spacing-32), 38rem);
    max-block-size: min(90vh, 48rem);
    overflow: auto;
    border-radius: var(--border-radius-24);
    box-shadow: var(--shadow-large);
  }

  .component:global(.page) {
    inline-size: min(100%, 44rem);
    border-radius: var(--border-radius-16);
  }

  .header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--spacing-16);
  }

  .headingBlock {
    display: grid;
    gap: var(--spacing-4);
    min-inline-size: 0;
  }

  .kicker {
    color: var(--color-text-muted);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
    letter-spacing: var(--letter-spacing-label);
    text-transform: uppercase;
  }

  .heading {
    text-wrap: balance;
  }

  .description {
    margin: 0;
    color: var(--color-text-tertiary);
    line-height: var(--line-height-body);
  }

  .closeButton {
    appearance: none;
    display: inline-grid;
    place-items: center;
    inline-size: 2.25rem;
    block-size: 2.25rem;
    padding: 0;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-12);
    background: var(--color-surface-primary);
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1rem;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard),
      color var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover {
      border-color: var(--color-border-strong);
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }

    &:focus-visible {
      border-color: var(--color-border-strong);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-focus);
    }

    &:disabled {
      border-color: transparent;
      background: var(--color-surface-secondary);
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
  }

  .fields {
    display: grid;
    gap: var(--spacing-16);
  }

  .field {
    display: grid;
    gap: var(--spacing-8);
  }

  .inputLabel {
    color: var(--color-text-secondary);
    font-size: var(--font-size-12);
    font-weight: var(--font-weight-medium);
  }

  .input {
    box-sizing: border-box;
    inline-size: 100%;
    min-block-size: 3rem;
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--border-radius-12);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);
    font: inherit;
    transition:
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:focus-visible {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
      outline: 0;
    }

    &:user-invalid {
      border-color: var(--color-danger-primary);
      box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-danger-primary) 24%, transparent);
    }

    &:disabled {
      color: var(--color-text-muted);
      cursor: not-allowed;
    }
  }

  .checkbox {
    inline-size: 1.25rem;
    block-size: 1.25rem;
    margin: 0;
    accent-color: var(--color-accent-primary);
  }

  .fieldset {
    display: grid;
    gap: var(--spacing-16);
    min-inline-size: 0;
    padding: var(--spacing-16);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--border-radius-16);
    background: var(--color-surface-secondary);
  }

  .legend {
    padding-inline: var(--spacing-4);
    color: var(--color-text-secondary);
    font-weight: var(--font-weight-semibold);
  }

  .propertyFields {
    display: grid;
    gap: var(--spacing-16);
  }

  .hint {
    margin: 0;
    color: var(--color-text-tertiary);
    font-size: var(--font-size-14);
  }

  .helperMessage {
    margin: 0;
    color: var(--color-text-tertiary);
  }

  .errorPanel {
    display: grid;
    gap: var(--spacing-12);
    justify-items: start;
  }

  .errorMessage {
    margin: 0;
    color: var(--color-danger-primary);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--spacing-12);
    align-items: center;
  }
</style>
