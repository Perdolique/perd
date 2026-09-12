import type { BrowserContext, Page } from '@playwright/test'
import { expect } from './global.fixtures.ts'

interface TwitchUserResponse {
  email: string | null;
  isAdmin: boolean;
  isGuest: false;
  userId: string;
}

interface MockTwitchSignInOptions {
  code?: string;
  redirectTo: string;
  user: TwitchUserResponse;
}

const twitchOAuthState = 't'.repeat(43)

/** Completes the browser callback with the protected OAuth response contract. */
async function mockTwitchSignIn(
  context: BrowserContext,
  page: Page,
  options: MockTwitchSignInOptions
): Promise<void> {
  const code = options.code ?? 'twitch-code'

  await context.route((url) => url.pathname === '/api/oauth/twitch', async (route) => {
    expect(route.request().method()).toBe('POST')

    expect(route.request().postDataJSON()).toStrictEqual({
      code,
      state: twitchOAuthState
    })

    await route.fulfill({
      json: {
        ...options.user,
        redirectTo: options.redirectTo
      }
    })
  })

  const query = new globalThis.URLSearchParams({
    code,
    state: twitchOAuthState
  })

  await page.goto(`/auth/twitch?${query}`)
}

export { mockTwitchSignIn }
