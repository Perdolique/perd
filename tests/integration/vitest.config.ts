// oxlint-disable import/no-default-export
import { defineConfig } from 'vitest/config'
import baseConfig from '../../vitest.config.ts'

export default defineConfig({
  ...baseConfig,

  test: {
    include: ['tests/integration/*.test.ts'],
    hookTimeout: 30_000,
    testTimeout: 20_000
  }
})
