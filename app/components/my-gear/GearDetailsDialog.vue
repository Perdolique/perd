<template>
  <ConfirmationDialog
    v-model="isOpened"
    :header-text="headerText"
    :confirm-button-text="confirmText"
    :confirm-disabled="loading"
    :confirm-loading="loading"
    :confirm-form="formId"
    :error="error"
  >
    <form :id="formId" ref="form" :class="$style.component" novalidate @submit.prevent="handleSubmit">
      <p v-if="catalogItem">
        Catalog item: <PerdLink :to="catalogLocation">{{ catalogItem.name }}</PerdLink>
      </p>
      <TextInput
        ref="nameInput"
        v-model="name"
        name="gear-name"
        :label="nameLabel"
        :hint="nameHint"
        :required="isNameRequired"
        :disabled="loading"
        :error="fieldErrors.name"
      />
      <div :class="$style.field">
        <label :for="noteId" :class="$style.label">Note</label>
        <textarea
          :id="noteId"
          v-model="note"
          :class="$style.textarea"
          name="gear-note"
          rows="3"
          :disabled="loading"
          :aria-invalid="noteAriaInvalid"
          :aria-describedby="noteDescription"
        />
        <span v-if="fieldErrors.note" :id="noteErrorId" :class="$style.error" role="alert">{{ fieldErrors.note }}</span>
      </div>
      <div :class="$style.field">
        <NumberInput
          v-model="measuredWeightGrams"
          label="Measured weight per item"
          name="gear-weight"
          unit="g"
          :hint="weightFallbackHint"
          :disabled="loading"
          :error="fieldErrors.measuredWeightGrams"
        />
      </div>
      <div :class="$style.field">
        <label :for="quantityId" :class="$style.label">Owned quantity</label>
        <input
          :id="quantityId"
          v-model="ownedQuantity"
          :class="$style.quantity"
          name="gear-quantity"
          type="text"
          inputmode="numeric"
          required
          :disabled="loading"
          :aria-invalid="quantityAriaInvalid"
          :aria-describedby="quantityDescription"
        >
        <span v-if="fieldErrors.ownedQuantity" :id="quantityErrorId" :class="$style.error" role="alert">{{ fieldErrors.ownedQuantity }}</span>
      </div>
    </form>
  </ConfirmationDialog>
</template>

<script lang="ts">
  interface GearDetailsInput {
    name: string;
    note: string | null;
    measuredWeightGrams: string | null;
    ownedQuantity: number;
  }

  export type { GearDetailsInput }
</script>

<script lang="ts" setup>
  import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
  import * as v from 'valibot'
  import { limits } from '#shared/constants'

  import {
    compareDecimalNumbers,
    decimalNumberPattern,
    isFiniteDecimalNumber,
    normalizeDecimalNumber
  } from '#shared/utils/decimal-number'

  import type { MyGearRecord } from '~/types/equipment'
  import { createGearLibraryItemLocation } from '~/utils/navigation'
  import TextInput from '~/components/TextInput.vue'
  import NumberInput from '~/components/NumberInput.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    error: string | null;
    initialGear: MyGearRecord | null;
    loading: boolean;
  }

  type Emits = (event: 'save', input: GearDetailsInput) => void

  const { error, initialGear, loading } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isOpened = defineModel<boolean>({ required: true })
  const name = ref('')
  const note = ref('')
  const measuredWeightGrams = ref('')
  const ownedQuantity = ref('1')
  const fieldErrors = ref<Partial<Record<keyof GearDetailsInput, string>>>({})
  const nameInput = useTemplateRef('nameInput')
  const form = useTemplateRef('form')
  const componentId = useId()
  const formId = `${componentId}-form`
  const noteId = `${componentId}-note`
  const noteErrorId = `${componentId}-note-error`
  const quantityId = `${componentId}-quantity`
  const quantityErrorId = `${componentId}-quantity-error`
  const catalogItem = computed(() => initialGear?.source === 'catalog' ? initialGear.item : null)
  const catalogLocation = computed(() => catalogItem.value === null ? '' : createGearLibraryItemLocation(catalogItem.value.id))
  const isNameRequired = computed(() => catalogItem.value === null)
  const nameLabel = computed(() => isNameRequired.value ? 'Gear name' : 'Personal name')
  const nameHint = computed(() => isNameRequired.value ? undefined : 'Leave blank to use the catalog name.')
  const headerText = computed(() => initialGear === null ? 'Add custom gear' : 'Edit gear')
  const confirmText = computed(() => initialGear === null ? 'Add gear' : 'Save changes')
  const hasNoteError = computed(() => fieldErrors.value.note !== undefined)
  const noteAriaInvalid = computed(() => hasNoteError.value || undefined)
  const noteDescription = computed(() => hasNoteError.value ? noteErrorId : undefined)
  const hasQuantityError = computed(() => fieldErrors.value.ownedQuantity !== undefined)
  const quantityAriaInvalid = computed(() => hasQuantityError.value || undefined)
  const quantityDescription = computed(() => hasQuantityError.value ? quantityErrorId : undefined)

  const weightFallbackHint = computed(() => {
    const catalogWeight = catalogItem.value?.weightGrams

    return catalogWeight === null || catalogWeight === undefined
      ? 'Leave blank to keep the weight unknown.'
      : `Leave blank to use catalog weight: ${catalogWeight} g.`
  })

  const weightSchema = v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(limits.maxUserEquipmentWeightLength, 'Use 64 characters or fewer.'),
    v.union([
      v.pipe(v.literal(''), v.transform(() => null)),
      v.pipe(
        v.string(),
        v.regex(decimalNumberPattern, 'Enter a weight in grams, for example 18.25.'),
        v.check(isFiniteDecimalNumber, 'Enter a finite weight.'),
        v.transform(normalizeDecimalNumber),
        v.check((value) => compareDecimalNumbers(value, '0') >= 0, 'Weight must not be negative.')
      )
    ])
  )

  const formSchema = v.object({
    name: v.pipe(
      v.string(),
      v.trim(),
      v.check((value) => !isNameRequired.value || value !== '', 'Enter a gear name.'),
      v.maxLength(limits.maxUserEquipmentCustomNameLength, 'Use 128 characters or fewer.')
    ),

    note: v.pipe(
      v.string(),
      v.trim(),
      v.maxLength(limits.maxUserEquipmentNoteLength, 'Use 2000 characters or fewer.'),
      v.transform((value) => value === '' ? null : value)
    ),

    measuredWeightGrams: weightSchema,

    ownedQuantity: v.pipe(
      v.string(),
      v.trim(),
      v.regex(/^\d+$/u, 'Enter a whole number of 1 or more.'),
      v.transform(Number),
      v.integer('Enter a whole number.'),
      v.minValue(1, 'Enter a quantity of 1 or more.'),
      v.maxValue(limits.maxUserEquipmentOwnedQuantity, `Use ${limits.maxUserEquipmentOwnedQuantity} or fewer.`)
    )
  })

  watch(isOpened, async (opened) => {
    if (!opened) {
      return
    }

    name.value = initialGear?.source === 'catalog' ? initialGear.personalName ?? '' : initialGear?.customName ?? ''
    note.value = initialGear?.note ?? ''
    measuredWeightGrams.value = initialGear?.measuredWeightGrams ?? ''
    ownedQuantity.value = String(initialGear?.ownedQuantity ?? 1)
    fieldErrors.value = {}

    await nextTick()
    nameInput.value?.focus()
  })

  watch(() => loading, async (isLoading) => {
    if (isLoading || !isOpened.value || error === null) {
      return
    }

    await nextTick()
    nameInput.value?.focus()
  })

  async function handleSubmit() {
    if (loading) {
      return
    }

    const result = v.safeParse(formSchema, {
      name: name.value,
      note: note.value,
      measuredWeightGrams: measuredWeightGrams.value,
      ownedQuantity: ownedQuantity.value
    })

    fieldErrors.value = {}

    if (!result.success) {
      const errors = v.flatten(result.issues)

      fieldErrors.value = {
        name: errors.nested?.name?.[0],
        note: errors.nested?.note?.[0],
        measuredWeightGrams: errors.nested?.measuredWeightGrams?.[0],
        ownedQuantity: errors.nested?.ownedQuantity?.[0]
      }

      await nextTick()
      form.value?.querySelector<HTMLInputElement | HTMLTextAreaElement>('[aria-invalid="true"]')?.focus()

      return
    }

    emit('save', result.output)
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
  }

  .field {
    display: grid;
    gap: var(--spacing-8);
  }

  .textarea,
  .quantity {
    inline-size: 100%;
    min-block-size: var(--layout-button-height-medium);
    padding: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background-color: var(--color-background-elevated);
    color: var(--color-text-primary);

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    &[aria-invalid='true'] {
      border-color: var(--color-danger-primary);
    }
  }

  .textarea {
    resize: vertical;
  }

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .error {
    color: var(--color-danger-primary);
  }
</style>
