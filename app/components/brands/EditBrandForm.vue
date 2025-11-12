<template>
  <form
    :class="$style.form"
    :disabled="submitting"
    @submit.prevent="onSubmit"
  >
    <div :class="$style.inputs">
      <PerdInput
        required
        autofocus
        autocomplete="off"
        label="Name"
        placeholder="The West Pace"
        v-model.trim="name"
      />

      <PerdInput
        label="Website URL"
        placeholder="https://perd.perd.workers.dev"
        type="url"
        v-model.trim="websiteUrl"
      />
    </div>

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
  import PerdButton from '~/components/PerdButton.vue'
  import PerdInput from '~/components/PerdInput.vue'

  interface Props {
    readonly submitting: boolean;
    readonly saveButtonText: string;
  }

  type Emits = (event: 'submit') => void;

  defineProps<Props>()

  const emit = defineEmits<Emits>()
  const router = useRouter()

  const name = defineModel<string>('name', {
    required: true
  })

  const websiteUrl = defineModel<string>('websiteUrl', {
    required: true
  })

  function onSubmit() {
    emit('submit')
  }

  function onCancel() {
    router.back()
  }
</script>

<style module>
  .form {
    display: grid;
    row-gap: var(--spacing-32);
    max-width: 400px;
  }

  .inputs {
    display: grid;
    gap: var(--spacing-16);
  }

  .buttons {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    column-gap: var(--spacing-16);
  }
</style>
