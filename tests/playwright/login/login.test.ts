import type { Route } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

const brandsApiRoute = '**/api/equipment/brands'
const buildCommitSha = 'abc1234567890abcdef1234567890abcdef12345'
const buildCommitShortSha = buildCommitSha.slice(0, 7)
const repositoryUrl = 'https://github.com/Perdolique/perd'
const buildCommitUrl = `${repositoryUrl}/commit/${buildCommitSha}`

async function continueRoute(route: Route) {
  await route.continue()
}

test.describe('Login page', () => {
  test('should display auth buttons and build links', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('button', { name: 'Guest' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Twitch' })).toBeVisible()

    const githubLink = page.getByRole('link', { name: 'GitHub', exact: true })
    const commitLink = page.getByRole('link', { name: `#${buildCommitShortSha}`, exact: true })

    await expect(githubLink).toBeVisible()
    await expect(githubLink).toHaveAttribute('href', repositoryUrl)
    await expect(githubLink).toHaveAttribute('target', '_blank')
    await expect(githubLink).toHaveAttribute('rel', 'noreferrer')

    await expect(page.locator('footer')).toContainText(`Commit #${buildCommitShortSha}`)
    await expect(commitLink).toBeVisible()
    await expect(commitLink).toHaveAttribute('href', buildCommitUrl)
    await expect(commitLink).toHaveAttribute('target', '_blank')
    await expect(commitLink).toHaveAttribute('rel', 'noreferrer')
  })

  test('should return to the api document after guest login', async ({ page }) => {
    await page.route(brandsApiRoute, continueRoute)
    await page.goto('/api/equipment/brands')
    await page.unroute(brandsApiRoute, continueRoute)

    await expect(page).toHaveURL(/\/login\?redirectTo=\/api\/equipment\/brands$/u)

    await page.route('**/api/auth/create-session', async (route) => {
      await route.fulfill({
        status: 201,

        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
        }
      })
    })

    await page.route(brandsApiRoute, async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.getByRole('button', { name: 'Guest' }).click()

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)
    await expect(page.locator('body')).toHaveText('[]')
  })

  test('should start twitch oauth from the login page', async ({ page }) => {
    await page.route('**/api/oauth/twitch**', async (route) => {
      await route.fulfill({
        contentType: 'text/plain',
        body: 'oauth start'
      })
    })

    const twitchRequestPromise = page.waitForRequest((request) => {
      const requestUrl = new globalThis.URL(request.url())

      return requestUrl.pathname === '/api/oauth/twitch'
    })

    await page.goto('/login?redirectTo=/')
    await page.getByRole('button', { name: 'Twitch' }).click()

    const twitchRequest = await twitchRequestPromise
    const twitchRequestUrl = new globalThis.URL(twitchRequest.url())

    expect(twitchRequest.method()).toBe('GET')
    expect(twitchRequestUrl.searchParams.get('redirectTo')).toBe('/')

    await expect.poll(() => {
      const currentUrl = new globalThis.URL(page.url())

      return {
        pathname: currentUrl.pathname,
        redirectTo: currentUrl.searchParams.get('redirectTo')
      }
    }).toStrictEqual({
      pathname: '/api/oauth/twitch',
      redirectTo: '/'
    })

    await expect(page.locator('body')).toHaveText('oauth start')
  })

  test('should restore api redirects after the twitch callback', async ({ page }) => {
    await page.route('**/api/oauth/twitch', async (route) => {
      await route.fulfill({
        json: {
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7',
          isAdmin: false
        }
      })
    })

    await page.route('**/api/equipment/brands', async (route) => {
      await route.fulfill({
        json: []
      })
    })

    await page.goto('/auth/twitch?code=oauth-code&state=%2Fapi%2Fequipment%2Fbrands')

    await expect(page).toHaveURL(/\/api\/equipment\/brands$/u)
    await expect(page.locator('body')).toHaveText('[]')
  })
})
