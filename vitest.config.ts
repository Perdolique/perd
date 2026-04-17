// oxlint-disable import/no-default-export
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('app', import.meta.url)),
      '@@': import.meta.dirname,
      '~': fileURLToPath(new URL('app', import.meta.url)),
      '~~': import.meta.dirname,
      '#server': fileURLToPath(new URL('server', import.meta.url)),
      '#shared': fileURLToPath(new URL('shared', import.meta.url))
    }
  },

  test: {
    include: ['**/__tests__/*.test.ts']
  }
})
