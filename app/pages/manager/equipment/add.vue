<template>
  <div :class="$style.component">
    <form
      :class="$style.form"
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
  </div>
</template>

<script lang="ts" setup>
  definePageMeta({
    middleware: ['admin']
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

<style module lang="scss">
  .component {
    padding: 16px;
  }

  .form {
    width: 100%;
    max-width: var(--screen-mobile-m);
    display: grid;
    row-gap: 16px;
    margin: auto;
  }
</style>
