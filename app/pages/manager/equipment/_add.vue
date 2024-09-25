<template>
  <form
    :class="$style.component"
    @submit.prevent="handleSubmit"
  >
    <PerdInput
      required
      autofocus
      autocomplete="off"
      label="Item name"
      placeholder="MGS Bubba Hubba UL2"
      v-model="name"
    />

    <PerdInput
      autocomplete="off"
      label="Weight"
      inputmode="numeric"
      pattern="\d*"
      placeholder="1488"
      v-model="weight"
    />

    <PerdButton type="submit">
      Add item
    </PerdButton>
  </form>
</template>

<script lang="ts" setup>
  import PerdButton from '~/components/PerdButton.vue';
  import PerdInput from '~/components/PerdInput.vue';

  definePageMeta({
    middleware: ['admin'],
    title: 'Add equipment'
  })

  const name = ref('')
  const weight = ref('')

  function clearForm() {
    name.value = ''
    weight.value = ''
  }

  async function handleSubmit() {
    try {
      await $fetch('/api/admin/create-equipment', {
        method: 'POST',

        body: {
          name: name.value,
          weight: Number(weight.value)
        }
      })

      clearForm()
    } catch (error) {
      console.error(error)
    }
  }
</script>

<style module>
  .component {
    width: 100%;
    max-width: var(--screen-mobile-l);
    display: grid;
    row-gap: var(--spacing-16);
  }
</style>
