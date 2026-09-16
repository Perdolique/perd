import type { BrowserContext } from '@playwright/test'

interface AccountUser {
  email: string | null;
  isAdmin: boolean;
  isGuest: boolean;
  isTwitchLinked: boolean;
  userId: string;
}

async function mockAccountUser(context: BrowserContext, user: AccountUser): Promise<void> {
  await context.route('**/api/user', async (route) => {
    await route.fulfill({ json: user })
  })
}

export { mockAccountUser }
