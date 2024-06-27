// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { 
    enabled: true 
  },

  nitro: {
    preset: 'cloudflare-pages',
    compatibilityDate: '2024-06-27'
  },

  features: {
    compatibilityVersion: 4
  },

  modules: [
    '@nuxthub/core'
  ],

  hub: {
    database: true,
    remote: true
  }
})