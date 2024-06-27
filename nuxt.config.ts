// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { 
    enabled: true 
  },

  modules: [
    // '@nuxthub/core'
  ],

  feature: {
    compatibilityVersion: 4
  },

  hub: {
    database: true
  }
})