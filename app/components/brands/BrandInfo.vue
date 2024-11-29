<template>
  <div :class="$style.component">
    <BrandInfoItem icon="tabler:package">
      {{ equipmentCount }}
    </BrandInfoItem>

    <BrandInfoItem
      v-if="websiteUrl"
      icon="tabler:world"
    >
      <PerdLink
        :to="websiteUrl"
        target="_blank"
        @click.stop
      >
        Website
      </PerdLink>
    </BrandInfoItem>
  </div>
</template>

<script lang="ts" setup>
  import PerdLink from '~/components/PerdLink.vue';
  import BrandInfoItem from './BrandInfoItem.vue';

  interface Props {
    readonly equipmentCount: number;
    readonly websiteUrl: string | null;
  }

  defineProps<Props>();
</script>

<style module>
  .component {
    display: flex;
    column-gap: var(--spacing-12);
  }
</style>
