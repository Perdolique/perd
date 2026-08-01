import { expect, test } from '../fixtures/global.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const firstImageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8'
const secondImageId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const imagesPath = `/api/equipment/items/${itemId}/images`
const previewUrl = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>'

const firstImage = {
  cloudflareImageId: 'cloudflare-image-1',
  displayOrder: 0,
  id: firstImageId,
  previewUrl
}

const secondImage = {
  cloudflareImageId: 'cloudflare-image-2',
  displayOrder: 1,
  id: secondImageId,
  previewUrl
}

test.describe('Equipment image management', () => {
  test('should delete an image and refresh the gallery order', async ({
    context,
    page
  }) => {
    let images = [firstImage, secondImage]
    let deleteRequestCount = 0

    await context.route('**/api/oauth/twitch**', async (route) => {
      await route.fulfill({
        json: {
          isAdmin: true,
          userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
        }
      })
    })

    await context.route(imagesPath, async (route) => {
      expect(route.request().method()).toBe('GET')

      await route.fulfill({ json: images })
    })

    await context.route(`${imagesPath}/${firstImageId}`, async (route) => {
      expect(route.request().method()).toBe('DELETE')

      deleteRequestCount += 1
      images = [secondImage]

      await route.fulfill({ status: 204 })
    })

    const pagePath = `/admin/equipment/items/${itemId}/images`
    const authPath = `/auth/twitch?code=oauth-code&state=${encodeURIComponent(pagePath)}`

    await page.goto(authPath)

    await expect(page).toHaveURL(new RegExp(`${pagePath}$`, 'u'))
    await expect(page.getByRole('button', { name: 'Delete equipment image 1' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Delete equipment image/u })).toHaveCount(2)

    await page.getByRole('button', { name: 'Delete equipment image 1' }).click()

    await expect.poll(() => deleteRequestCount).toBe(1)
    await expect(page.getByRole('button', { name: /^Delete equipment image/u })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Delete equipment image 1' })).toBeVisible()
    await expect(page.getByText('Primary', { exact: true })).toBeVisible()
  })
})
