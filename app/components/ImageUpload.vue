<template>
  <button
    type="button"
    :class="$style.component"
    @click="onButtonClick"
  >
    <img
      v-if="imageFileObjectUrl"
      :src="imageFileObjectUrl"
      alt="Uploaded image"
      :class="$style.image"
    />

    <Icon
      v-else
      size="1.5rem"
      name="tabler:upload"
      :class="$style.icon"
    />

    <input
      type="file"
      accept="image/png, image/jpeg, image/webp"
      ref="fileInput"
      :class="$style.input"
      @change="onFileChange"
    />
  </button>
</template>

<script lang="ts" setup>
  const fileInputRef = useTemplateRef('fileInput');
  const imageFile = ref<File | null>(null);

  const imageFileObjectUrl = computed(() => {
    if (imageFile.value === null) {
      return null;
    }

    return URL.createObjectURL(imageFile.value);
  });

  function onButtonClick() {
    fileInputRef.value?.click();
  }

  function onFileChange(event: Event) {
    if (event.target instanceof HTMLInputElement) {
      const file = event.target.files?.[0];

      if (file !== undefined) {
        imageFile.value = file;
      }
    }
  }

  // Revoke the old object URL when the image file changes
  watch(imageFileObjectUrl, (_, oldObjectUrl) => {
    if (oldObjectUrl !== null) {
      URL.revokeObjectURL(oldObjectUrl);
    }
  });

  // Revoke the object URL when the component is unmounted
  onBeforeUnmount(() => {
    if (imageFileObjectUrl.value !== null) {
      URL.revokeObjectURL(imageFileObjectUrl.value);
    }
  });
</script>

<style module>
  .component {
    align-content: center;
    outline: none;
    border: 1px solid var(--input-color-border);
    border-radius: var(--input-border-radius);
    background-color: var(--input-color-background);
    overflow: hidden;
    transition: border-color var(--transition-time-quick);

    &:hover,
    &:focus-visible{
      border-color: var(--input-color-focus);
    }
  }

  .image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .icon {
    display: block;
    margin: 0 auto;
    color: var(--input-color-focus);
    transition: scale var(--transition-time-quick);

    .component:hover &,
    .component:focus-visible & {
      scale: 1.3;
    }
  }

  .input {
    display: none;
  }
</style>
