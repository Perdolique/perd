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
