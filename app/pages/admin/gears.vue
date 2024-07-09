<template>
  <div :class="$style.component">
    <form
      :class="$style.form"
      @submit.prevent="handleSubmit"
    >
      <PerdInput
        required
        label="Gear name"
        placeholder="MGS Bubba Hubba UL2"
        v-model="name"
      />

      <PerdInput
        label="Weight"
        inputmode="numeric"
        pattern="\d*"
        placeholder="1488"
        v-model="weight"
      />

      <PerdButton type="submit">
        Add gear
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

  function handleSubmit() {
    console.log('woof', name.value, weight.value);
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
