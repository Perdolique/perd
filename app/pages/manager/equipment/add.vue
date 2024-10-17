<template>
  <PageContent page-title="Add new equipment">
    <form
      :class="$style.page"
      :disabled="isSubmitting"
      @submit.prevent="submitForm"
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
          :options="types"
          :class="$style.type"
          v-model="selectedType"
        />

        <PerdSelect
          required
          placeholder="Equipment group"
          :options="groups"
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
  </PageContent>
</template>

<script lang="ts" setup>
  import { FetchError } from 'ofetch';
  import ImageUpload from '~/components/ImageUpload.vue';
  import PageContent from '~/components/layout/PageContent.vue';
  import PerdButton from '~/components/PerdButton.vue';
  import PerdInput from '~/components/PerdInput.vue';
  import PerdSelect from '~/components/PerdSelect.vue';
  import PerdTextArea from '~/components/PerdTextArea.vue';

  interface Option {
    readonly value: string;
    readonly label: string;
  }

  definePageMeta({
    layout: 'page',
    middleware: ['admin']
  })

  const name = ref('')
  const description = ref('')
  const weight = ref('')
  const selectedType = ref('')
  const selectedGroup = ref('')
  const isSubmitting = ref(false)
  const types = ref<Option[]>([])
  const groups = ref<Option[]>([])
  const { addToast } = useToaster()

  const { data, error } = await useAsyncData('typesAndGroups', async () => {
    const requestFetch = useRequestFetch()

    // TODO: Move these to state
    const typesPromise = requestFetch('/api/equipment/types')
    const groupsPromise = requestFetch('/api/equipment/groups')
    const [typesResponse, groupsResponse] = await Promise.all([typesPromise, groupsPromise])

    return { typesResponse, groupsResponse };
  }, {
    transform: ({ typesResponse, groupsResponse }) => {
      return {
        types: typesResponse.map((type) => ({
          value: `${type.id}`,
          label: type.name
        })),

        groups: groupsResponse.map((group) => ({
          value: `${group.id}`,
          label: group.name
        }))
      };
    }
  });

  if (error.value !== undefined) {
    addToast({
      title: 'Data fetch error',
      message: error.value.message
    })
  }

  if (data.value !== undefined) {
    types.value = data.value.types
    groups.value = data.value.groups
  }

  function resetForm() {
    name.value = ''
    description.value = ''
    weight.value = ''
    selectedType.value = ''
    selectedGroup.value = ''
  }

  async function submitForm() {
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
  .page {
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
