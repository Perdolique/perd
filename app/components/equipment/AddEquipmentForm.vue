<template>
  <EmptyState
    v-if="hasError"
    icon="streamline-emojis:face-screaming-in-fear"
  >
    Can't load required data
  </EmptyState>

  <form
    v-else
    :class="$style.form"
    :disabled="isSubmitting"
    @submit.prevent="onSubmit"
  >
    <div :class="$style.inputs">
      <ImageUpload :class="$style.image" />

      <PerdInput
        required
        autocomplete="off"
        label="Name"
        placeholder="Ultralight Tent"
        :class="$style.name"
        v-model.trim="name"
      />

      <PerdTextArea
        label="Description"
        placeholder="A lightweight tent for backpacking."
        v-model.trim="description"
        :class="$style.description"
      />

      <PerdInput
        required
        autocomplete="off"
        label="Weight"
        placeholder="1488"
        inputmode="numeric"
        pattern="\d*"
        :class="$style.weight"
        v-model.trim="weight"
      />

      <PerdSelect
        required
        placeholder="Equipment type"
        :options="typeOptions"
        :class="$style.type"
        v-model="selectedType"
      />

      <PerdSelect
        required
        placeholder="Equipment group"
        :options="groupOptions"
        :class="$style.group"
        v-model="selectedGroup"
      />
    </div>

    <hr :class="$style.divider">

    <PerdButton
      type="submit"
      :class="$style.button"
    >
      Add equipment
    </PerdButton>
  </form>
</template>

<script lang="ts" setup>
  import { FetchError } from 'ofetch';
  import ImageUpload from '~/components/ImageUpload.vue';
  import PerdButton from '~/components/PerdButton.vue';
  import PerdInput from '~/components/PerdInput.vue';
  import PerdSelect from '~/components/PerdSelect.vue';
  import PerdTextArea from '~/components/PerdTextArea.vue';
  import EmptyState from '~/components/EmptyState.vue';

  const name = ref('')
  const description = ref('')
  const weight = ref('')
  const selectedType = ref('')
  const selectedGroup = ref('')
  const isSubmitting = ref(false)
  const { addToast } = useToaster()
  const { groups, fetchGroups, hasError: hasGroupsError } = useEquipmentGroupsState()
  const { types, fetchTypes, hasError: hasTypesError } = useEquipmentTypesState()

  const groupOptions = computed(() => {
    return groups.value.map((group) => ({
      value: group.id.toString(),
      label: group.name
    }))
  })

  const typeOptions = computed(() => {
    return types.value.map((type) => ({
      value: type.id.toString(),
      label: type.name
    }))
  })

  const hasError = computed(() => hasGroupsError.value || hasTypesError.value)

  await Promise.all([fetchGroups(), fetchTypes()])

  function resetForm() {
    name.value = ''
    description.value = ''
    weight.value = ''
    selectedType.value = ''
    selectedGroup.value = ''
  }

  async function onSubmit() {
    if (isSubmitting.value) {
      return
    }

    try {
      isSubmitting.value = true

      const descriptionValue = description.value === '' ? undefined : description.value

      await $fetch('/api/equipment', {
        method: 'POST',

        body: {
          name: name.value,
          description: descriptionValue,
          weight: parseInt(weight.value),
          typeId: parseInt(selectedType.value),
          groupId: parseInt(selectedGroup.value)
        }
      })

      addToast({
        title: 'Equipment added 🎉',
        message: 'The equipment has been successfully added.'
      })

      resetForm()
    } catch (error) {
      if (error instanceof FetchError) {
        addToast({
          title: 'Failed to add equipment 🥲',
          message: error.data.message
        })
      }
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<style lang="scss" module>
  .form {
    display: grid;
    row-gap: var(--spacing-16);

    @include mobileLarge() {
      row-gap: var(--spacing-32);
    }
  }

  .inputs {
    display: grid;
    gap: var(--spacing-16);

    grid-template-areas:
      "image"
      "name"
      "description"
      "weight"
      "type"
      "group";

    @include mobileLarge() {
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "image name name"
        "image description description"
        "weight type group";
    }

    @include tablet() {
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: auto 1fr;
      grid-template-areas:
        "image name name name"
        "image description description description"
        "image weight type group"
    }

    @include laptop() {
      grid-template-columns: auto 1fr 1fr;
      grid-template-rows: auto auto auto auto;
      grid-template-areas:
        "image name description"
        "image weight description"
        "image type description"
        "image group description";
    }
  }

  .image {
    grid-area: image;
    aspect-ratio: 1 / 1;
    min-width: 200px;
    justify-self: center;

    @include mobileLarge() {
      width: 100%;
    }

    @include laptop() {
      max-width: 200px;
      width: 100%;
      justify-self: end;
    }
  }

  .name {
    grid-area: name;
  }

  .description {
    grid-area: description;
    height: 100%;
    min-height: 100px;
  }

  .weight {
    grid-area: weight;
  }

  .type {
    grid-area: type;
  }

  .group {
    grid-area: group;
  }

  .divider {
    display: none;

    @include mobileLarge() {
      display: block;
      height: 1px;
      border: none;
      background-color: var(--accent-200);
      margin: 0 var(--spacing-16);
    }
  }

  .button {
    width: 100%;

    @include mobileLarge() {
      max-width: 300px;
      justify-self: center;
    }
  }
</style>
