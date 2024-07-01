// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: {
    enabled: true
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

  modules: [
    'nitro-cloudflare-dev'
  ],
})
