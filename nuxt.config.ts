// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    '@nuxt/icon'
  ],

  experimental: {
    viewTransition: true
  },

  typescript: {
    strict: true,
    typeCheck: true
  },

  app: {
    rootAttrs: {
      class: 'perd-root'
    }
  },

  devtools: {
    enabled: true
  },

  components: {
    dirs: []
  },

  compatibilityDate: '2024-07-03',

  nitro: {
    preset: 'cloudflare-pages'
  },

  future: {
    compatibilityVersion: 4
  },

  icon: {
    clientBundle: {
      scan: true
    }
  },

  vue: {
    compilerOptions: {
      /**
       * We're using new `<select>` customizations
       *
       * @see [RFC Customizable Select](https://developer.chrome.com/blog/rfc-customizable-select?hl=en)
       */
      isCustomElement: (tag) => tag === 'selectedoption'
    }
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',

          additionalData: `
@use "~/assets/styles/media" as *;
@use "~/assets/styles/utils" as *;
`
        }
      }
    }
  }
})
