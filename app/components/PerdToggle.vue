<template>
  <label
    :class="$style.component"
  >
    <input
      :class="$style.checkbox"
      type="checkbox"
      v-model="model"
    />

    <Icon
      :class="$style.mark"
      name="tabler:check"
    />
  </label>
</template>

<script lang="ts" setup>
  const model = defineModel<boolean>({
    required: true
  });
</script>

<style module>
  .component {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .checkbox {
    appearance: none;
    width: 20px;
    height: 20px;
    background-color: var(--primary-50);
    border: 1px solid var(--primary-300);
    border-radius: 6px;
    outline-offset: 2px;
    outline: 2px solid transparent;
    transition:
      outline var(--transition-time-quick) ease-out,
      background-color var(--transition-time-quick) ease-out;

    &:focus-visible {
      outline: 2px solid var(--primary-400);
    }

    &:checked {
      background-color: var(--primary-500);
    }
  }

  .mark {
    position: absolute;
    color: var(--primary-50);
  }
</style>
