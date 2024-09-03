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
    strict: true
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
