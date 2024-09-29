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
    outline: 2px solid transparent;
    border: 1px solid var(--color-blue-500);
    border-radius: var(--border-radius-24);
    background-color: var(--color-blue-100);
    cursor: pointer;
    overflow: hidden;
    transition:
      background-color 0.2s,
      border-color 0.2s,
      outline-color 0.2s;

    &:hover,
    &:focus-visible{
      background-color: var(--color-blue-200);
      border-color: var(--color-blue-600);
      outline-color: var(--color-blue-600);
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
    color: var(--color-blue-500);
    transition:
      color 0.2s,
      scale 0.2s;

    .component:hover &,
    .component:focus-visible & {
      color: var(--color-blue-600);
      scale: 1.3;
    }
  }

  .input {
    display: none;
  }
</style>
