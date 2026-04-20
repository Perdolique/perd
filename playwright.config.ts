import { defineConfig, devices, type ReporterDescription } from '@playwright/test'
import { appBaseUrl } from './tests/playwright/constants.ts'

const isCI = Boolean(process.env.CI)

const reporters: ReporterDescription[] = [
  ['html', { open: 'never' }]
]

if (isCI) {
  reporters.unshift(['github'])
}

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: isCI,

  // Retry on CI only
  retries: isCI ? 2 : 0,
  reporter: reporters,

  use: {
    baseURL: appBaseUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [{
    name: 'Chrome Desktop',
    use: { ...devices['Desktop Chrome'] }
  }],

  // Run the production preview before E2E. `preview:e2e` owns the writable temp-dir setup for Wrangler state.
  webServer: {
    command: 'pnpm run preview:e2e',
    url: appBaseUrl,
    reuseExistingServer: !isCI
  }
})
