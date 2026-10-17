<template>
  <ConfirmationDialog
    v-model="isOpened"
    :header-text="headerText"
    confirm-button-text="Save changes"
    :confirm-form="formId"
    :confirm-disabled="isSaving"
    :confirm-loading="isSaving"
    :error="errorMessage"
  >
    <form :id="formId" ref="form" :class="$style.component" novalidate @submit.prevent="handleSave">
      <div :class="$style.field">
        <label :for="quantityId">Quantity</label>
        <input
          :id="quantityId"
          ref="quantityInput"
          v-model="quantity"
          :class="$style.quantity"
          name="packing-quantity"
          type="text"
          inputmode="numeric"
          required
          :disabled="isSaving"
          :aria-invalid="quantityAriaInvalid"
          :aria-describedby="quantityDescription"
        >
        <span v-if="quantityError" :id="quantityErrorId" :class="$style.error" role="alert">{{ quantityError }}</span>
      </div>
      <NumberInput
        v-if="isCustom"
        v-model="weight"
        label="Weight per item"
        name="packing-weight"
        unit="g"
        hint="Leave empty if the weight is unknown."
        :disabled="isSaving"
        :error="weightError"
      />
      <p v-else :class="$style.weight">
        {{ weightText }}. Edit the weight in <PerdLink :to="appLocations.myGear">My gear</PerdLink>.
      </p>
    </form>
  </ConfirmationDialog>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch } from 'vue'
  import { limits } from '#shared/constants'
  import { compareDecimalNumbers, isFiniteDecimalNumber, normalizeDecimalNumber } from '#shared/utils/decimal-number'
  import type { PackingListEntry, PackingListEntryEditBody } from '~/types/packing'
  import { usePackingListsStore } from '~/stores/packing-lists'
  import { formatPackingEntryWeight } from '~/utils/packing'
  import { appLocations } from '~/utils/navigation'
  import NumberInput from '~/components/NumberInput.vue'
  import PerdLink from '~/components/PerdLink.vue'
  import ConfirmationDialog from '~/components/dialogs/ConfirmationDialog.vue'

  interface Props {
    entry: PackingListEntry | null;
    packingListId: string;
  }

  interface Emits {
    saved: [entry: PackingListEntry, packingListUpdatedAt: string];
  }

  const { entry, packingListId } = defineProps<Props>()
  const emit = defineEmits<Emits>()
  const isOpened = defineModel<boolean>({ required: true })
  const store = usePackingListsStore()
  const quantityInput = useTemplateRef('quantityInput')
  const form = useTemplateRef('form')
  const componentId = useId()
  const formId = `${componentId}-form`
  const quantityId = `${componentId}-quantity`
  const quantityErrorId = `${componentId}-quantity-error`
  const quantity = ref('1')
  const weight = ref('')
  const quantityError = ref<string>()
  const weightError = ref<string>()
  const errorMessage = ref<string | null>(null)
  const isSaving = ref(false)
  const quantityAriaInvalid = computed(() => quantityError.value === undefined ? undefined : true)
  const quantityDescription = computed(() => quantityError.value === undefined ? undefined : quantityErrorId)
  const isCustom = computed(() => entry?.source === 'custom')
  const itemName = computed(() => entry?.source === 'inventory' ? entry.inventory.itemName : entry?.customName ?? 'item')
  const headerText = computed(() => `Edit ${itemName.value}`)
  const weightText = computed(() => entry === null ? 'Weight unknown' : formatPackingEntryWeight(entry))
  let isActive = true

  onBeforeUnmount(() => {
    isActive = false
  })

  watch(isOpened, async (opened) => {
    if (!opened || entry === null) {
      return
    }

    quantity.value = String(entry.quantity)
    weight.value = entry.weightGrams ?? ''
    quantityError.value = undefined
    weightError.value = undefined
    errorMessage.value = null

    await nextTick()
    quantityInput.value?.focus()
  })

  function validateDraft() {
    const quantityText = quantity.value.trim()
    const nextQuantity = Number(quantityText)
    const draftWeight = weight.value.trim()

    const validQuantity = /^\d+$/u.test(quantityText) && Number.isInteger(nextQuantity)
      && nextQuantity >= 1 && nextQuantity <= limits.maxUserEquipmentOwnedQuantity

    const validWeight = draftWeight === '' || (draftWeight.length <= limits.maxUserEquipmentWeightLength
      && isFiniteDecimalNumber(draftWeight) && compareDecimalNumbers(draftWeight, '0') >= 0)

    quantityError.value = validQuantity ? undefined : 'Enter a whole number from 1 to 2147483647.'
    weightError.value = isCustom.value && !validWeight ? 'Enter a non-negative weight in grams using a decimal point (up to 64 characters).' : undefined
    errorMessage.value = null
  }

  async function handleSave() {
    if (isSaving.value || entry === null) {
      return
    }

    validateDraft()

    const nextQuantity = Number(quantity.value.trim())
    const draftWeight = weight.value.trim()

    if (quantityError.value !== undefined || weightError.value !== undefined) {
      await nextTick()

      if (quantityError.value === undefined) {
        form.value?.querySelector<HTMLInputElement>('[name="packing-weight"]')?.focus()
      } else {
        quantityInput.value?.focus()
      }

      return
    }

    const nextWeight = draftWeight === '' ? null : normalizeDecimalNumber(draftWeight)
    const body: PackingListEntryEditBody = {}

    if (nextQuantity !== entry.quantity) {
      body.quantity = nextQuantity
    }

    if (isCustom.value && nextWeight !== entry.weightGrams) {
      body.weightGrams = nextWeight
    }

    if (Object.keys(body).length === 0) {
      isOpened.value = false

      return
    }

    isSaving.value = true

    try {
      const response = await store.editPackingListEntry(packingListId, entry.id, body)

      if (isActive && response !== null) {
        emit('saved', response.entry, response.packingListUpdatedAt)

        isOpened.value = false
      }
    } catch (error) {
      globalThis.console.error('Failed to edit packing list entry:', error)

      if (isActive) {
        errorMessage.value = 'Could not save changes. Try again.'
      }
    } finally {
      isSaving.value = false
    }
  }
</script>

<style module>
  .component {
    display: grid;
    gap: var(--spacing-16);
    min-inline-size: 0;
  }

  .field {
    display: grid;
    gap: var(--spacing-8);
  }

  .quantity {
    inline-size: 100%;
    min-inline-size: 0;
    min-block-size: var(--layout-button-height-medium);
    padding-inline: var(--spacing-12);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--layout-button-radius-small);
    background: var(--color-background-elevated);
    color: var(--color-text-primary);
    font: inherit;

    &:focus-visible {
      outline: 2px solid var(--color-accent-primary);
      outline-offset: 2px;
    }

    &[aria-invalid='true'] {
      border-color: var(--color-danger-primary);
    }
  }

  .error {
    color: var(--color-danger-primary);
  }

  .weight {
    overflow-wrap: anywhere;
  }
</style>
