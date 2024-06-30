// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: {
    enabled: true
  },

  nitro: {
    preset: 'cloudflare-pages',

    cloudflareDev: {
      environmnet: 'preview'
    }
  },

  future: {
    compatibilityVersion: 4
  },

  modules: [
    'nitro-cloudflare-dev'
  ],
})
