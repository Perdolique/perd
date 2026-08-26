<template>
  <div :class="$style.component">
    <form :class="$style.form" @submit.prevent="handleSubmit">
      <div v-if="hasMandatoryReferenceError" :class="$style.alert" role="alert">
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
          :model-value="selectedBrandId"
          label="Brand"
          :options="brandOptions"
          :disabled="isMandatorySelectDisabled"
          :pending="isMandatoryReferenceLoading"
          required
          @update:model-value="setBrandId"
        />

        <PerdSelect
          :model-value="selectedCategorySlug"
          label="Category"
          :options="categoryOptions"
          :disabled="isMandatorySelectDisabled"
          :pending="isMandatoryReferenceLoading"
          required
          @update:model-value="requestCategoryChange"
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

        <div v-if="hasCategoryDetailError" :class="$style.alert" role="alert">
          <span>{{ categoryDetailErrorMessage }}</span>

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

      <p v-if="hasMutationMessage" :class="$style.errorMessage" role="alert">
        {{ mutationMessage }}
      </p>

      <div :class="$style.actions">
        <PerdButton type="submit" :disabled="isSubmitDisabled" :loading="isSubmitting">
          {{ submitLabel }}
        </PerdButton>

        <template v-if="isReviewMode">
          <PerdButton
            type="button"
            :disabled="isDecisionDisabled"
            @click="openPublishConfirmation"
          >
            Publish
          </PerdButton>

          <PerdButton
            type="button"
            variant="danger"
            :disabled="isDecisionDisabled"
            @click="openRejectConfirmation"
          >
            Reject
          </PerdButton>
        </template>
      </div>
    </form>

    <ConfirmationDialog
      v-model="showCategoryChangeConfirmation"
      header-text="Change category"
      confirm-button-text="Change category"
      @confirm="confirmCategoryChange"
    >
      Changing the category clears the entered characteristics. Continue?
    </ConfirmationDialog>

    <ConfirmationDialog
      v-model="showPublishConfirmation"
      header-text="Publish submission"
      confirm-button-text="Publish"
      :confirm-loading="isSubmitting"
      @confirm="confirmPublish"
    >
      Publish the current corrected item to Gear library?
    </ConfirmationDialog>

    <ConfirmationDialog
      v-model="showRejectConfirmation"
      header-text="Reject submission"
      confirm-button-text="Reject"
      confirm-variant="danger"
      :confirm-disabled="isRejectConfirmDisabled"
      :confirm-loading="isSubmitting"
      @confirm="confirmReject"
    >
      <TextInput
        v-model="rejectionReason"
        label="Reason"
        name="rejection-reason"
        :disabled="isSubmitting"
        :maxlength="maxRejectionReasonLength"
        required
      />
    </ConfirmationDialog>
  </div>
</template>

<script lang="ts">
  interface EquipmentItemEditorProperty {
    propertyId: number;
    value: boolean | string;
  }

  interface EquipmentItemEditorValue {
    brandId: number;
    categoryId: number;
    name: string;
    properties: EquipmentItemEditorProperty[];
  }

  export type { EquipmentItemEditorValue }
</script>

<script lang="ts" setup>
  /* oxlint-disable max-lines -- The shared editor owns its reference requests, dynamic fields, validation, and category-change confirmation. */
  import { computed, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
  import { useAsyncData, useFetch, useRequestFetch } from '#imports'
  import { limits } from '#shared/constants'
  import { isFiniteDecimalNumber } from '#shared/utils/decimal-number'
  import type { CategoryDetailResponse } from '#server/api/equipment/categories/by-slug/[slug].get'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'
  import NumberInput from '~/components/NumberInput.vue'
  import PerdButton from '~/components/PerdButton.vue'
  import PerdSelect, { type PerdSelectOption } from '~/components/perd-select/PerdSelect.vue'
  import TextInput from '~/components/TextInput.vue'

  interface Props {
    autofocus?: boolean;
    initialValue: EquipmentItemEditorValue;
    isSubmitting: boolean;
    mode: 'create' | 'review';
    mutationMessage?: string | null;
  }

  interface Emits {
    publish: [value: EquipmentItemEditorValue];
    reject: [value: EquipmentItemEditorValue, rejectionReason: string];
    submit: [value: EquipmentItemEditorValue];
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

  interface SubmissionPropertiesResult {
    errors: Record<number, boolean>;
    hasValidationError: boolean;
    properties: EquipmentItemEditorProperty[];
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const requestFetch = useRequestFetch()
  const knownPropertiesTitleId = useId()
  const itemNameInput = useTemplateRef('itemNameInput')
  const maxItemNameLength = limits.maxEquipmentItemNameLength
  const maxRejectionReasonLength = limits.maxEquipmentItemRejectionReasonLength
  const itemName = ref('')
  const selectedBrandId = ref('')
  const selectedCategorySlug = ref('')
  const pendingCategorySlug = ref('')
  const showCategoryChangeConfirmation = ref(false)
  const showPublishConfirmation = ref(false)
  const showRejectConfirmation = ref(false)
  const rejectionReason = ref('')
  const propertyValues = ref<Record<number, unknown>>({})

  function focusNameInput() {
    itemNameInput.value?.focus()
  }

  const brandsRequestPromise = useFetch('/api/equipment/brands', {
    default: () => [],
    key: `equipment-item-editor-brands-${props.mode}`
  })

  const categoriesRequestPromise = useFetch('/api/equipment/categories', {
    default: () => [],
    key: `equipment-item-editor-categories-${props.mode}`
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

  itemName.value = props.initialValue.name
  selectedBrandId.value = props.initialValue.brandId === 0 ? '' : `${props.initialValue.brandId}`

  const initialCategory = categoriesResponse.value.find(
    (category) => category.id === props.initialValue.categoryId
  )

  selectedCategorySlug.value = initialCategory?.slug ?? ''

  const categoryDetailRequest = await useAsyncData(
    `equipment-item-editor-category-detail-${props.mode}`,
    async (_nuxtApp, { signal }): Promise<CategoryDetailResponse | null> => {
      const categorySlug = selectedCategorySlug.value

      if (categorySlug === '') {
        return null
      }

      const categoryDetailPath = `/api/equipment/categories/by-slug/${categorySlug}` as const

      const response = await requestFetch(categoryDetailPath, {
        method: 'get',
        signal
      })

      return response
    },
    {
      default: () => null,
      lazy: true
    }
  )

  const {
    data: categoryDetail,
    error: categoryDetailError,
    refresh: refreshCategoryDetail,
    status: categoryDetailStatus
  } = categoryDetailRequest

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

    return [{
      label: 'Select a brand',
      value: ''
    }, ...options]
  })

  const categoryOptions = computed<PerdSelectOption[]>(() => {
    const options = categoriesResponse.value.map((category) => {
      return {
        label: category.name,
        value: category.slug
      }
    })

    return [{
      label: 'Select a category',
      value: ''
    }, ...options]
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
    props.isSubmitting || isMandatoryReferenceReady.value === false
  ))

  const mandatoryAriaBusy = computed(() => isMandatoryReferenceLoading.value || undefined)
  const hasSelectedCategory = computed(() => selectedCategorySlug.value !== '')

  const isCategoryDetailLoading = computed(() => (
    selectedCategorySlug.value !== '' && categoryDetailStatus.value === 'pending'
  ))

  const hasCategoryDetailError = computed(() => categoryDetailError.value !== undefined)

  const categoryDetailErrorMessage = computed(() => props.mode === 'review'
    ? 'Could not load characteristics. Retry before saving the full submission.'
    : 'Could not load characteristics. You can still submit the basic item.')

  const hasMutationMessage = computed(() => props.mutationMessage !== undefined && props.mutationMessage !== null)
  const isReviewMode = computed(() => props.mode === 'review')
  const submitLabel = computed(() => props.mode === 'review' ? 'Save changes' : 'Submit for review')
  const trimmedItemName = computed(() => itemName.value.trim())

  const selectedBrand = computed(() => {
    const brandId = Number(selectedBrandId.value)

    return brandsResponse.value.find((brand) => brand.id === brandId)
  })

  const selectedCategory = computed(() => categoriesResponse.value.find(
    (category) => category.slug === selectedCategorySlug.value
  ))

  function getPropertyFieldValue(rawValue: unknown) {
    if (typeof rawValue === 'string') {
      return rawValue
    }

    if (typeof rawValue === 'number') {
      return Number.isFinite(rawValue) ? `${rawValue}` : ''
    }

    if (typeof rawValue === 'boolean') {
      return rawValue ? 'true' : 'false'
    }

    return ''
  }

  function createSubmissionProperties(): SubmissionPropertiesResult {
    const errors: Record<number, boolean> = {}
    const properties: EquipmentItemEditorProperty[] = []
    const definitions = categoryDetail.value?.properties ?? []
    let hasValidationError = false

    for (const property of definitions) {
      const fieldValue = getPropertyFieldValue(propertyValues.value[property.id])
      const trimmedValue = fieldValue.trim()
      const hasValue = trimmedValue !== ''
      const isNumberProperty = property.dataType === 'number'

      const hasError = hasValue
        && isNumberProperty
        && isFiniteDecimalNumber(trimmedValue) === false

      errors[property.id] = hasError
      hasValidationError ||= hasError

      if (hasValue && hasError === false) {
        const value = property.dataType === 'boolean'
          ? trimmedValue === 'true'
          : trimmedValue

        properties.push({
          propertyId: property.id,
          value
        })
      }
    }

    return {
      errors,
      hasValidationError,
      properties
    }
  }

  const submissionProperties = computed(createSubmissionProperties)

  const propertyFields = computed<PropertyFieldView[]>(() => {
    const properties = categoryDetail.value?.properties ?? []

    return properties.map((property) => {
      const propertyEnumOptions = property.enumOptions ?? []

      const selectableOptions = propertyEnumOptions.map((option) => {
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
        ...selectableOptions
      ]

      const value = getPropertyFieldValue(propertyValues.value[property.id])

      const error = submissionProperties.value.errors[property.id] === true
        ? 'Enter a valid decimal number.'
        : undefined

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
    && hasCategoryDetailError.value === false
    && categoryDetail.value !== null
  ))

  const currentValue = computed<EquipmentItemEditorValue | null>(() => {
    const brand = selectedBrand.value
    const category = selectedCategory.value

    if (brand === undefined || category === undefined || trimmedItemName.value === '') {
      return null
    }

    const result = submissionProperties.value

    if (result.hasValidationError) {
      return null
    }

    return {
      brandId: brand.id,
      categoryId: category.id,
      name: trimmedItemName.value,
      properties: result.properties
    }
  })

  function serializeValue(value: EquipmentItemEditorValue) {
    const properties = value.properties.toSorted((left, right) => left.propertyId - right.propertyId)

    return JSON.stringify({
      brandId: value.brandId,
      categoryId: value.categoryId,
      name: value.name,
      properties
    })
  }

  const isDirty = computed(() => {
    const { value } = currentValue

    return value !== null && serializeValue(value) !== serializeValue(props.initialValue)
  })

  const isReviewDetailUnavailable = computed(() => (
    props.mode === 'review'
    && (categoryDetail.value === null || hasCategoryDetailError.value || isCategoryDetailLoading.value)
  ))

  const isSubmitDisabled = computed(() => (
    currentValue.value === null
    || isMandatoryReferenceReady.value === false
    || isReviewDetailUnavailable.value
    || props.isSubmitting
    || (props.mode === 'review' && isDirty.value === false)
  ))

  const isDecisionDisabled = computed(() => (
    currentValue.value === null
    || isMandatoryReferenceReady.value === false
    || isReviewDetailUnavailable.value
    || props.isSubmitting
  ))

  const trimmedRejectionReason = computed(() => rejectionReason.value.trim())

  const isRejectConfirmDisabled = computed(() => (
    props.isSubmitting || trimmedRejectionReason.value === ''
  ))

  function clearPropertyState() {
    propertyValues.value = {}
  }

  function setBrandId(value: string) {
    selectedBrandId.value = value
  }

  function hasEnteredProperties() {
    const hasLoadedPropertyValues = Object.values(propertyValues.value).some(
      (value) => getPropertyFieldValue(value) !== ''
    )

    const hasUnavailableInitialProperties = props.mode === 'review'
      && selectedCategory.value?.id === props.initialValue.categoryId
      && categoryDetail.value === null
      && props.initialValue.properties.length > 0

    return hasLoadedPropertyValues || hasUnavailableInitialProperties
  }

  function requestCategoryChange(value: string) {
    if (value === selectedCategorySlug.value) {
      return
    }

    if (hasEnteredProperties()) {
      pendingCategorySlug.value = value
      showCategoryChangeConfirmation.value = true

      return
    }

    selectedCategorySlug.value = value
  }

  function confirmCategoryChange() {
    clearPropertyState()

    selectedCategorySlug.value = pendingCategorySlug.value
    pendingCategorySlug.value = ''
  }

  async function retryMandatoryReferences() {
    await Promise.all([
      refreshBrands(),
      refreshCategories()
    ])
  }

  async function retryCategoryDetail() {
    await refreshCategoryDetail()
  }

  function handleSubmit() {
    const { value } = currentValue

    if (isSubmitDisabled.value || value === null) {
      return
    }

    emit('submit', value)
  }

  function openPublishConfirmation() {
    if (isDecisionDisabled.value) {
      return
    }

    showPublishConfirmation.value = true
  }

  function openRejectConfirmation() {
    if (isDecisionDisabled.value) {
      return
    }

    showRejectConfirmation.value = true
  }

  function confirmPublish() {
    const { value } = currentValue

    if (isDecisionDisabled.value || value === null) {
      return
    }

    emit('publish', value)
  }

  function confirmReject() {
    const { value } = currentValue

    if (isDecisionDisabled.value || isRejectConfirmDisabled.value || value === null) {
      return
    }

    emit('reject', value, trimmedRejectionReason.value)
  }

  function reset(value: EquipmentItemEditorValue) {
    itemName.value = value.name
    selectedBrandId.value = value.brandId === 0 ? '' : `${value.brandId}`

    const category = categoriesResponse.value.find((entry) => entry.id === value.categoryId)

    selectedCategorySlug.value = category?.slug ?? ''

    if (categoryDetail.value?.id === value.categoryId) {
      propertyValues.value = Object.fromEntries(
        value.properties.map((property) => [property.propertyId, property.value])
      )
    }
  }

  watch(
    () => props.initialValue,
    (value) => reset(value),
    { immediate: true }
  )

  watch(categoriesResponse, () => {
    const category = categoriesResponse.value.find((entry) => entry.id === props.initialValue.categoryId)

    if (selectedCategorySlug.value === '' && category !== undefined) {
      selectedCategorySlug.value = category.slug
    }
  }, { immediate: true })

  watch(selectedCategorySlug, async () => {
    clearPropertyState()

    categoryDetail.value = null

    await refreshCategoryDetail()
  })

  watch(categoryDetail, (value) => {
    if (value?.id === props.initialValue.categoryId) {
      propertyValues.value = Object.fromEntries(
        props.initialValue.properties.map((property) => [property.propertyId, property.value])
      )
    }
  }, { immediate: true })

  onMounted(() => {
    if (props.autofocus) {
      focusNameInput()
    }
  })

</script>

<style module>
  .component {
    container-type: inline-size;
  }

  .properties,
  .propertyFields {
    display: grid;
    gap: var(--spacing-16);
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

  .sectionHeading,
  .alert,
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-12);
  }

  .sectionHeading,
  .alert {
    justify-content: space-between;
  }

  .heading {
    font-size: var(--font-size-20);
    line-height: var(--line-height-snug);
  }

  .alert {
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
</style>
