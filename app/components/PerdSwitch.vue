<template>
  <button
    :aria-checked="checked"
    role="switch"
    :class="[$style.component, { checked }]"
    @click="handleClick"
  >
    <div
      inert
      :class="[$style.knob, { checked }]"
    />
  </button>
</template>

<script lang="ts" setup>
  const checked = defineModel<boolean>({
    required: true
  })

  function handleClick() {
    checked.value = !checked.value
  }
</script>

<style module>
  .component {
    border: none;
    outline: none;
    padding: 0;
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background-color: color-mix(
      in srgb,
      var(--input-color-placeholder),
      transparent 50%
    );
    cursor: pointer;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition:
      background-color var(--transition-time-quick),
      outline-color var(--transition-time-quick);

    &:focus-visible {
      outline-color: var(--input-color-focus);
    }

    &:global(.checked) {
      background-color: var(--input-color-main);
    }
  }

  .knob {
    display: inline-block;
    position: absolute;
    width: 14px;
    height: 14px;
    left: 4px;
    top: 4px;
    background-color: var(--button-color-text);
    border-radius: 50%;
    transition: left var(--transition-time-quick) ease-out;

    &:global(.checked) {
      left: 22px;
    }
  }
</style>
