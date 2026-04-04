import { test as base, type APIRequestContext } from '@playwright/test'
import { appBaseUrl } from './constants'

interface WorkerFixtures { authedRequest: APIRequestContext }

export const test = base.extend<Record<never, never>, WorkerFixtures>({
  authedRequest: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext({
        baseURL: appBaseUrl
      })

      await request.post('/api/auth/create-session')
      await use(request)
      await request.dispose()
    },
    { scope: 'worker' }
  ]
})
