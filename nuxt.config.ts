// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    'nitro-cloudflare-dev',
    '@nuxt/fonts'
  ],

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
  }
})
