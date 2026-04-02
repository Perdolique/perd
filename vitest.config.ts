// oxlint-disable import/no-default-export
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/__tests__/*.test.ts']
  }
})
