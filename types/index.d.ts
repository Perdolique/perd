declare module '#app' {
  interface PageMeta {
    skipAuth?: boolean;
  }
}

// It is always important to ensure you import/export something when augmenting a type
// https://nuxt.com/docs/4.x/guide/going-further/runtime-config#typing-runtime-config
