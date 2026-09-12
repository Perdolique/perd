import { unstable_dev, type Unstable_DevWorker } from 'wrangler'
import { expect, test } from '../fixtures/global.fixtures.ts'

let worker: Unstable_DevWorker | null = null

function getWorker() {
  if (worker === null) {
    throw new Error('Disabled registration Worker is unavailable')
  }

  return worker
}

test.describe('Disabled email registration', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    worker = await unstable_dev('.output/server/index.mjs', {
      config: 'wrangler.jsonc',
      envFiles: ['tests/playwright/registration/disabled.env'],
      local: true,
      ip: '127.0.0.1',
      port: 0,
      inspectorPort: 0,
      logLevel: 'error',

      experimental: {
        disableExperimentalWarning: true,
        disableDevRegistry: true,
        watch: false
      }
    })
  })

  test.afterAll(async () => {
    await worker?.stop()
  })

  for (const path of ['/register', '/auth/verify-email']) {
    test(`should return 404 for ${path} in the browser`, async ({ page }) => {
      const activeWorker = getWorker()
      const response = await page.goto(`http://${activeWorker.address}:${activeWorker.port}${path}`)

      expect(response?.status()).toBe(404)
      await expect(page.getByRole('textbox')).toHaveCount(0)
    })
  }

  for (const path of ['/api/auth/email/registration', '/api/auth/email/registration/verify']) {
    test(`should return 404 for ${path} without database, origin or mail configuration`, async () => {
      const activeWorker = getWorker()
      const response = await activeWorker.fetch(path, { method: 'POST' })

      expect(response.status).toBe(404)
    })
  }

  for (const path of ['/forgot-password', '/auth/reset-password']) {
    test(`should keep ${path} available when registration is disabled`, async ({ page }) => {
      const activeWorker = getWorker()
      const response = await page.goto(`http://${activeWorker.address}:${activeWorker.port}${path}`)

      expect(response?.status()).toBe(200)
      await expect(page.getByRole('heading')).toBeVisible()
    })
  }

  for (const path of ['/api/auth/email/password-recovery', '/api/auth/email/password-recovery/reset']) {
    test(`should keep ${path} independent of the registration flag`, async () => {
      const activeWorker = getWorker()
      const origin = `http://${activeWorker.address}:${activeWorker.port}`

      const response = await activeWorker.fetch(path, {
        method: 'POST',

        headers: {
          'content-type': 'application/json',
          origin
        },

        body: '{}'
      })

      expect(response.status).not.toBe(404)
    })
  }

  test('should hide registration from login', async ({ page }) => {
    const activeWorker = getWorker()

    await page.goto(`http://${activeWorker.address}:${activeWorker.port}/login`)
    await expect(page.getByRole('link', { name: 'Create account' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Guest' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeVisible()
  })
})
