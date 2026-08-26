<template>
  <div :class="$style.component">
    <label :for="inputId" :class="$style.label">
      {{ label }}
    </label>

    <label
      :for="inputId"
      ref="dropZone"
      :class="[$style.dropZone, {
        hasError,
        isDisabled: disabled,
        isDragging
      }]"
    >
      <input
        :id="inputId"
        ref="input"
        :class="$style.input"
        :accept="acceptedImageTypesAttribute"
        :aria-describedby="describedBy"
        :aria-invalid="ariaInvalid"
        :aria-label="label"
        :disabled="disabled"
        :multiple="multiple"
        :name="name"
        :required="required"
        type="file"
        @change="handleInputChange"
      >

      <div v-if="hasSelection" :class="$style.selection">
        <slot name="selection" :files="files">
          <p :class="$style.selectionSummary">
            {{ selectionSummary }}
          </p>
        </slot>
      </div>

      <div v-else :class="$style.emptyState">
        <Icon name="hugeicons:upload-02" :class="$style.uploadIcon" aria-hidden="true" />

        <p :class="$style.prompt">
          Click to choose or drag and drop
        </p>
      </div>
    </label>

    <p :id="hintId" :class="$style.hint">
      JPEG, PNG, or WebP, up to 5 MB
    </p>

    <p
      v-if="hasError"
      :id="errorId"
      :class="$style.error"
      role="alert"
    >
      {{ displayedError }}
    </p>
  </div>
</template>

<script lang="ts" setup>
  import { useDropZone } from '@vueuse/core'
  import { computed, ref, useId, useTemplateRef, watch } from 'vue'

  interface Props {
    disabled?: boolean;
    error?: string;
    label: string;
    multiple?: boolean;
    name: string;
    required?: boolean;
  }

  const {
    disabled,
    error,
    label,
    multiple,
    name,
    required
  } = defineProps<Props>()

  const emit = defineEmits<{
    'selection-change': [];
  }>()

  const files = defineModel<File[]>({ required: true })
  const componentId = useId()
  const inputId = `${componentId}-input`
  const hintId = `${componentId}-hint`
  const errorId = `${componentId}-error`
  const input = useTemplateRef('input')
  const dropZone = useTemplateRef('dropZone')
  const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
  const acceptedImageTypeSet = new Set<string>(acceptedImageTypes)
  const acceptedImageTypesAttribute = acceptedImageTypes.join(',')
  const validationError = ref<string | null>(null)
  const hasSelection = computed(() => files.value.length > 0)
  const displayedError = computed(() => validationError.value ?? error)
  const hasError = computed(() => displayedError.value !== undefined)
  const ariaInvalid = computed(() => hasError.value || undefined)

  const describedBy = computed(
    () => hasError.value ? `${hintId} ${errorId}` : hintId
  )

  const selectionSummary = computed(() => {
    const fileCount = files.value.length

    if (fileCount === 1) {
      return files.value[0]?.name ?? ''
    }

    return `${fileCount} files selected`
  })

  function synchronizeInputFiles(selectedFiles: File[]) {
    if (input.value === null) {
      return
    }

    const dataTransfer = new globalThis.DataTransfer()

    for (const file of selectedFiles) {
      dataTransfer.items.add(file)
    }

    input.value.files = dataTransfer.files
  }

  function getSelectionError(selectedFiles: File[]): string | null {
    if (multiple !== true && selectedFiles.length > 1) {
      return 'Choose one image at a time.'
    }

    const hasUnsupportedImage = selectedFiles.some(
      (file) => acceptedImageTypeSet.has(file.type) === false
    )

    return hasUnsupportedImage
      ? 'Choose JPEG, PNG, or WebP images.'
      : null
  }

  function setSelectedFiles(selectedFiles: File[] | null, synchronizeInput = true) {
    if (disabled) {
      return
    }

    const nextFiles = selectedFiles ?? []
    const nextError = getSelectionError(nextFiles)

    if (nextError !== null) {
      validationError.value = nextError
      synchronizeInputFiles(files.value)

      return
    }

    validationError.value = null

    const acceptedFiles = multiple ? nextFiles : nextFiles.slice(0, 1)

    files.value = acceptedFiles

    if (synchronizeInput) {
      synchronizeInputFiles(acceptedFiles)
    }

    emit('selection-change')
  }

  const { isOverDropZone } = useDropZone(dropZone, {
    onDrop: (selectedFiles) => setSelectedFiles(selectedFiles),
    preventDefaultForUnhandled: true
  })

  const isDragging = computed(
    () => disabled !== true && isOverDropZone.value
  )

  watch(
    () => files.value,
    (nextFiles) => {
      if (nextFiles.length === 0) {
        validationError.value = null
        synchronizeInputFiles(nextFiles)
      }
    }
  )

  function handleInputChange(event: Event) {
    const target = event.currentTarget

    if (target instanceof globalThis.HTMLInputElement) {
      setSelectedFiles(target.files === null ? [] : [...target.files], false)
    }
  }

  function focus() {
    input.value?.focus()
  }

  defineExpose({ focus })
</script>

<style module>
  .component {
    display: grid;
    align-content: start;
    gap: var(--spacing-8);
  }

  .label {
    color: var(--color-text-secondary);
    font-size: var(--font-size-14);
    font-weight: var(--font-weight-semibold);
  }

  .dropZone {
    position: relative;
    display: grid;
    place-items: center;
    min-block-size: 12rem;
    overflow: hidden;
    border: 1px dashed var(--color-border-strong);
    border-radius: var(--border-radius-16);
    background-color: var(--color-surface-secondary);
    cursor: pointer;
    transition:
      background-color var(--transition-duration-fast) var(--transition-easing-standard),
      border-color var(--transition-duration-fast) var(--transition-easing-standard),
      box-shadow var(--transition-duration-fast) var(--transition-easing-standard);

    &:hover:not(:global(.isDisabled)),
    &:global(.isDragging) {
      border-color: var(--color-accent-primary);
      background-color: var(--color-accent-subtle);
    }

    &:has(.input:focus-visible) {
      border-color: var(--color-accent-primary);
      box-shadow: var(--shadow-focus);
    }

    &:global(.hasError) {
      border-color: var(--color-danger-primary);
    }

    &:global(.isDisabled) {
      cursor: not-allowed;
      opacity: 0.65;
    }
  }

  .input {
    position: absolute;
    z-index: 1;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    opacity: 0;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
    }
  }

  .emptyState {
    display: grid;
    justify-items: center;
    gap: var(--spacing-12);
    padding: var(--spacing-24);
    color: var(--color-text-secondary);
    text-align: center;
  }

  .uploadIcon {
    color: var(--color-accent-primary);
    font-size: var(--font-size-40);
  }

  .prompt {
    font-weight: var(--font-weight-semibold);
  }

  .selection {
    inline-size: 100%;
    block-size: 100%;
  }

  .selectionSummary {
    display: grid;
    place-items: center;
    min-block-size: 12rem;
    padding: var(--spacing-24);
    overflow-wrap: anywhere;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--font-size-14);
  }

  .error {
    color: var(--color-danger-primary);
  }

  @media (forced-colors: active) {
    .dropZone:has(.input:focus) {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
</style>
