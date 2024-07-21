// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    'nitro-cloudflare-dev',
    '@nuxt/fonts',
    '@nuxt/icon'
  ],

  experimental: {
    viewTransition: true
  },

  devtools: {
    enabled: true
  },

  components: {
    dirs: []
  },

  icon: {
    fallbackToApi: false,
    size: '32px'
  },

  compatibilityDate: '2024-07-03',

  nitro: {
    preset: 'cloudflare-pages',

    cloudflareDev: {
      environment: 'preview'
    }
  },

  future: {
    compatibilityVersion: 4
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/media" as *;'
        }
      }
    }
  }
})
