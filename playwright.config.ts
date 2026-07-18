import { env } from 'node:process'
import { defineConfig, devices, type ReporterDescription } from '@playwright/test'
import { appBaseUrl } from './tests/playwright/constants.ts'

// Playwright forces color for the web server and workers, so inherited NO_COLOR only makes Node warn.
delete env.NO_COLOR

const isCI = Boolean(env.CI)
const e2eWebServerCommand = isCI
  ? 'pnpm run build:e2e && pnpm run preview:e2e'
  : 'vp run build:e2e && vp run preview:e2e'

const reporters: ReporterDescription[] = [
  ['html', { open: 'never' }]
]

if (isCI) {
  reporters.unshift(['github'])
}

export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  globalTimeout: 300_000,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: isCI,

  // Retry on CI only
  retries: isCI ? 1 : 0,
  failOnFlakyTests: isCI,
  reporter: reporters,

  use: {
    baseURL: appBaseUrl,
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'webkit',
      fullyParallel: false,
      grep: /@dialog-compatibility/u,
      testMatch: '**/dialogs/modal-dialog.test.ts',
      workers: 1,

      use: {
        ...devices['Desktop Safari'],

        launchOptions: {
          timeout: 30_000
        }
      }
    }
  ],

  // Build the same Cloudflare Worker artifact that is deployed, then run it locally in workerd.
  webServer: {
    command: e2eWebServerCommand,
    url: appBaseUrl,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: {
      signal: 'SIGINT',
      timeout: 5000
    }
  }
})
