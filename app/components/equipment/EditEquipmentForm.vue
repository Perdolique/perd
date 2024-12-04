<template>
  <form
    :class="$style.form"
    :disabled="submitting"
    @submit.prevent="onSubmit"
  >
    <div :class="$style.inputs">
      <ImageUpload :class="$style.image" />

      <ComboBox
        ignore-filter
        required
        :class="$style.brand"
        v-model:selected="brand"
        :options="brands"
        :loading="brandLoading"
        label="Brand"
        placeholder="Brand name"
        @search="onBrandSearch"
      />

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
        v-model="typeId"
      />

      <PerdSelect
        required
        placeholder="Equipment group"
        :options="groups"
        :class="$style.group"
        v-model="groupId"
      />
    </div>

    <hr :class="$style.divider">

    <div :class="$style.buttons">
      <PerdButton
        secondary
        type="button"
        :disabled="submitting"
        @click="onCancel"
      >
        Cancel
      </PerdButton>

      <PerdButton
        type="submit"
        :loading="submitting"
      >
        {{ saveButtonText }}
      </PerdButton>
    </div>
  </form>
</template>

<script lang="ts" setup>
  import { useDebounceFn } from '@vueuse/core'
  import ImageUpload from '~/components/ImageUpload.vue';
  import PerdButton from '~/components/PerdButton.vue';
  import PerdInput from '~/components/PerdInput.vue';
  import PerdSelect, { type SelectOption } from '~/components/PerdSelect.vue';
  import PerdTextArea from '~/components/PerdTextArea.vue';
  import ComboBox from '~/components/ComboBox/ComboBox.vue';

  export interface Brand {
    readonly value: string;
    readonly label: string;
  }

  interface Props {
    readonly groups: SelectOption[];
    readonly types: SelectOption[];
    readonly submitting: boolean;
    readonly saveButtonText: string;
  }

  type Emits = (event: 'submit') => void;

  defineProps<Props>()

  let abortController : AbortController | null = null
  const emit = defineEmits<Emits>()
  const router = useRouter()
  const brandLoading = ref(false)
  const brands = ref<Brand[]>([])

  const name = defineModel<string>('name', {
    required: true
  })

  const description = defineModel<string>('description', {
    required: true
  })

  const weight = defineModel<string>('weight', {
    required: true
  })

  const typeId = defineModel<string>('typeId', {
    required: true
  })

  const groupId = defineModel<string>('groupId', {
    required: true
  })

  const brand = defineModel<Brand | null>('brand', {
    required: true
  })

  const debouncedSearch = useDebounceFn(async (searchString: string) => {
    abortController = new AbortController()

    const result = await $fetch('/api/search/brands', {
      signal: abortController.signal,

      query: {
        search: searchString
      }
    })

    if (result !== undefined) {
      brands.value = result.map(({ id, name }) => ({
        label: name,
        value: id.toString()
      }))
    } else {
      brands.value = []
    }

    brandLoading.value = false;
  }, 300)

  async function onBrandSearch(searchString: string) {
    brandLoading.value = true;

    if (abortController !== null) {
      abortController.abort()
    }

    debouncedSearch(searchString)
  }

  async function onSubmit() {
    emit('submit')
  }

  function onCancel() {
    router.back()
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
      "brand"
      "name"
      "description"
      "weight"
      "type"
      "group";

    @include mobileLarge() {
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto auto 1fr auto;
      align-items: start;
      grid-template-areas:
        "image brand"
        "image name"
        "image description"
        "image weight"
        "image type"
        "image group";
    }

    @include tablet() {
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: auto 1fr;
      grid-template-areas:
        "image brand brand brand"
        "image name name name"
        "image description description description"
        "image weight type group"
    }

    @include laptop() {
      grid-template-columns: auto 1fr 1fr;
      grid-template-rows: auto auto auto auto;
      grid-template-areas:
        "image brand weight"
        "image name type"
        "image description group";
    }
  }

  .image {
    grid-area: image;
    aspect-ratio: 1 / 1;
    min-width: 200px;
    justify-self: center;

    @include mobileLarge() {
      width: 100%;
      max-width: 200px;
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

  .brand {
    grid-area: brand;
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

  .buttons {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    column-gap: var(--spacing-8);

    @include mobileLarge() {
      width: 400px;
      justify-self: center;
    }
  }
</style>
