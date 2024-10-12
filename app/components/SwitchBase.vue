<template>
  <component
    :is="as"
    :class="[$style.component, { checked, small }]"
  >
    <div
      inert
      :class="[$style.knob, { checked, small }]"
    />
  </component>
</template>

<script lang="ts" setup>
  interface Props {
    readonly checked: boolean;
    readonly small?: boolean;
    readonly as?: string;
  }

  const {
    as = 'span'
  } = defineProps<Props>()
</script>

<style module>
  .component {
    display: block;
    border: none;
    outline: none;
    padding: 0;
    position: relative;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    background-color: var(--primary-300);
    cursor: pointer;
    outline: 2px solid transparent;
    outline-offset: 2px;
    transition:
      background-color var(--transition-time-quick),
      outline-color var(--transition-time-quick);

    &:global(.small) {
      height: 12px;
      border-radius: 6px;
      width: 20px;
    }

    &:focus-visible {
      outline-color: var(--primary-300);
    }

    &:global(.checked) {
      background-color: var(--primary-500);
    }
  }

  .knob {
    display: inline-block;
    position: absolute;
    width: 14px;
    height: 14px;
    left: 4px;
    top: 4px;
    background-color: var(--primary-50);
    border-radius: 50%;
    transition: left var(--transition-time-quick) ease-out;

    &:global(.small) {
      width: 8px;
      height: 8px;
      left: 2px;
      top: 2px;
    }

    &:global(.checked) {
      left: 22px;

      &:global(.small) {
        left: 10px;
      }
    }
  }
</style>
