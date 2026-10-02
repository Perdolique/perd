import type { BrowserContext, Page, Request, Route } from '@playwright/test'
import * as v from 'valibot'
import type { BrandsListResponse } from '../../../server/api/equipment/brands/index.get.ts'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { createDeferred, mockCatalogApi } from '../fixtures/gear-library-entry-list.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'

const adminId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const path = '/admin/equipment/brands'
const apiPath = '/api/equipment/brands'

type Brand = BrandsListResponse[number]

interface SignInOptions {
  context: BrowserContext;
  isAdmin: boolean;
  page: Page;
  target?: string;
}

const brandBodySchema = v.object({
  name: v.string(),
  slug: v.string()
})

function isCreateBrandRequest(request: Request): boolean {
  const requestUrl = request.url()
  const url = new globalThis.URL(requestUrl)
  const method = request.method()
  const isCreateRequest = url.pathname === apiPath && method === 'POST'

  return isCreateRequest
}

async function signIn({ context, isAdmin, page, target = path }: SignInOptions) {
  await mockAccountUser(context, {
    email: null,
    isAdmin,
    isGuest: false,
    isTwitchLinked: true,
    userId: adminId
  })

  await mockTwitchSignIn(context, page, {
    redirectTo: target,

    user: {
      email: null,
      isAdmin,
      isGuest: false,
      userId: adminId
    }
  })
}

async function mockBrandStore(context: BrowserContext, initial: Brand[] = []) {
  const brands = [...initial]
  const itemPathPrefix = `${apiPath}/`
  let nextId = 20

  await context.route((url) => {
    const isItemPath = url.pathname.startsWith(itemPathPrefix)
    const isBrandPath = url.pathname === apiPath || isItemPath

    return isBrandPath
  }, async (route) => {
    const request = route.request()
    const requestUrl = request.url()
    const { pathname } = new globalThis.URL(requestUrl)
    const method = request.method()
    const isListRequest = pathname === apiPath && method === 'GET'
    const isCreateRequest = pathname === apiPath && method === 'POST'

    if (isListRequest) {
      await route.fulfill({ json: brands })

      return
    }

    if (isCreateRequest) {
      const rawBody: unknown = request.postDataJSON()
      const body = v.parse(brandBodySchema, rawBody)

      const brand = {
        id: nextId,
        name: body.name,
        slug: body.slug
      }

      nextId += 1

      brands.push(brand)

      await route.fulfill({
        status: 201,
        json: brand
      })

      return
    }

    const isItemPath = pathname.startsWith(itemPathPrefix)
    const isItemMutation = method === 'PATCH' || method === 'DELETE'
    const isSupportedMutation = isItemPath && isItemMutation

    if (!isSupportedMutation) {
      await route.fallback()

      return
    }

    const idText = pathname.slice(itemPathPrefix.length)
    const id = Number(idText)
    const index = brands.findIndex((brand) => brand.id === id)

    if (index === -1) {
      await route.fulfill({
        status: 404,
        json: { statusCode: 404 }
      })

      return
    }

    if (method === 'PATCH') {
      const rawBody: unknown = request.postDataJSON()
      const body = v.parse(brandBodySchema, rawBody)

      const brand = {
        id,
        name: body.name,
        slug: body.slug
      }

      brands[index] = brand

      await route.fulfill({ json: brand })

      return
    }

    brands.splice(index, 1)

    await route.fulfill({
      status: 204,
      body: ''
    })
  })

  return brands
}

async function fillBrandDialog(page: Page, name: string, slug?: string) {
  const dialog = page.getByRole('dialog', { name: /brand/u })

  await dialog.getByRole('textbox', { name: 'Name' }).fill(name)

  if (slug !== undefined) {
    await dialog.getByRole('textbox', { name: 'Slug' }).fill(slug)
  }

  return dialog
}

async function mockRecoveringBrands(context: BrowserContext, firstLoad: Promise<void>, retryLoad: Promise<void>) {
  let loads = 0
  let creates = 0

  await context.route((url) => url.pathname === apiPath, async (route) => {
    const request = route.request()
    const method = request.method()

    if (method === 'GET') {
      loads += 1

      if (loads <= 2) {
        await firstLoad

        await route.fulfill({
          status: 500,
          json: { statusCode: 500 }
        })

        return
      }

      await retryLoad

      await route.fulfill({ json: [] })

      return
    }

    if (method !== 'POST') {
      await route.fallback()

      return
    }

    creates += 1

    const statusMessage = creates === 1 ? 'Brand slug already exists' : 'Brand name already exists'

    await route.fulfill({
      status: 409,

      json: {
        statusCode: 409,
        statusMessage
      }
    })
  })
}

async function mockRetryDelete(context: BrowserContext) {
  const itemPath = `${apiPath}/10`
  let attempts = 0

  await context.route((url) => url.pathname === itemPath, async (route: Route) => {
    const request = route.request()
    const method = request.method()

    if (method !== 'DELETE') {
      await route.fallback()

      return
    }

    attempts += 1

    const response = attempts === 1
      ? {
        status: 409,

        json: {
          statusCode: 409,
          statusMessage: 'Brand is used by equipment'
        }
      }
      : {
        status: 204,
        body: ''
      }

    await route.fulfill(response)
  })

  return () => attempts
}

async function mockPendingBrandCreate(context: BrowserContext, release: Promise<void>) {
  let creates = 0

  await context.route((url) => url.pathname === apiPath, async (route) => {
    const request = route.request()
    const method = request.method()

    if (method === 'GET') {
      await route.fulfill({ json: [] })

      return
    }

    if (method !== 'POST') {
      await route.fallback()

      return
    }

    creates += 1
    await release

    await route.fulfill({
      status: 201,

      json: {
        id: 20,
        name: 'MSR',
        slug: 'msr'
      }
    })
  })

  return () => creates
}

test.describe('Admin brand management', () => {
  test('guards the page before brand data loads', async ({ context, page }) => {
    let brandRequests = 0

    page.on('request', (request) => {
      const requestUrl = request.url()
      const url = new globalThis.URL(requestUrl)
      const isBrandRequest = url.pathname === apiPath
      const requestCount = Number(isBrandRequest)

      brandRequests += requestCount
    })

    await signIn({
      context,
      page,
      isAdmin: false
    })

    await expect(page).toHaveURL(/\/$/u)
    expect(brandRequests).toBe(0)
  })

  test('creates, edits, searches, and deletes a brand by id', async ({ context, page }) => {
    await mockCatalogApi(context)

    const brands = await mockBrandStore(context, [{
      id: 10,
      name: 'MSR',
      slug: 'msr'
    }])

    await test.step('open the brand workspace from Admin', async () => {
      await signIn({
        context,
        page,
        isAdmin: true,
        target: '/admin'
      })

      const pathPattern = `${path}$`
      const expectedUrl = new RegExp(pathPattern, 'u')

      await page.getByRole('link', { name: 'Manage brands' }).click()
      await expect(page).toHaveURL(expectedUrl)
      await expect(page).toHaveTitle('Manage brands')
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('main').getByRole('searchbox', { name: 'Search brands' })).toBeVisible()
    })

    await test.step('create a brand with its suggested slug', async () => {
      await page.getByRole('button', { name: 'Add brand' }).click()

      const createDialog = await fillBrandDialog(page, 'Crème Brûlée')

      await expect(createDialog.getByRole('textbox', { name: 'Slug' })).toHaveValue('creme-brulee')
      await createDialog.getByRole('button', { name: 'Create brand' }).click()
      await expect(page.getByRole('status')).toContainText('Crème Brûlée created.')
      await expect(page.getByText('creme-brulee')).toBeVisible()
    })

    await test.step('reload and sign in again to read the saved brand', async () => {
      await page.reload()
      await expect(page).toHaveURL(/\/login\?redirectTo=/u)

      await signIn({
        context,
        page,
        isAdmin: true
      })

      await expect(page.getByRole('button', { name: 'Edit Crème Brûlée' })).toBeVisible()
    })

    await test.step('edit the same brand and search the updated list', async () => {
      await page.getByRole('button', { name: 'Edit Crème Brûlée' }).click()

      const editDialog = await fillBrandDialog(page, 'Crème Brûlée Plus')

      await expect(editDialog.getByRole('textbox', { name: 'Slug' })).toHaveValue('creme-brulee')
      await editDialog.getByRole('textbox', { name: 'Slug' }).fill('creme-brulee-plus')
      await editDialog.getByRole('button', { name: 'Save brand' }).click()
      await expect(page.getByRole('button', { name: 'Edit Crème Brûlée Plus' })).toBeVisible()

      const updatedBrand = brands.find((brand) => brand.id === 20)

      expect(updatedBrand?.slug).toBe('creme-brulee-plus')
      await page.getByRole('searchbox', { name: 'Search brands' }).fill('missing')
      await expect(page.getByText('No matching brands.')).toBeVisible()
      await page.getByRole('searchbox', { name: 'Search brands' }).fill('Brûlée')
      await expect(page.getByRole('button', { name: 'Edit MSR' })).toHaveCount(0)
    })

    await test.step('use the changed brand in catalog filters and gear submissions', async () => {
      await page.getByRole('navigation', { name: 'Workspace navigation' })
        .getByRole('link', { name: 'Gear library' }).click()

      await page.getByRole('button', { name: 'Filters' }).click()
      await expect(page.getByRole('checkbox', { name: 'Crème Brûlée Plus' })).toBeVisible()
      await page.getByRole('button', { name: 'Close filters' }).click()
      await page.getByRole('link', { name: 'Submit gear' }).click()

      const brandSelect = page.getByRole('combobox', { name: /^Brand/u })

      await brandSelect.click()
      await expect(page.getByRole('option', { name: 'Crème Brûlée Plus' })).toBeVisible()
    })

    await test.step('restore search focus when a rename removes the matching row', async () => {
      await page.getByRole('navigation', { name: 'Workspace navigation' })
        .getByRole('link', { name: 'Admin' }).click()

      await page.getByRole('link', { name: 'Manage brands' }).click()
      await page.getByRole('searchbox', { name: 'Search brands' }).fill('Brûlée')
      await page.getByRole('button', { name: 'Edit Crème Brûlée Plus' }).click()

      const renameDialog = await fillBrandDialog(page, 'Trail Stove')

      await renameDialog.getByRole('button', { name: 'Save brand' }).click()
      await expect(page.getByText('No matching brands.')).toBeVisible()
      await expect(page.getByRole('searchbox', { name: 'Search brands' })).toBeFocused()
    })

    await test.step('delete the brand by its stable id and restore search focus', async () => {
      await page.getByRole('searchbox', { name: 'Search brands' }).fill('')
      await page.getByRole('button', { name: 'Delete Trail Stove' }).click()
      await page.getByRole('dialog', { name: 'Delete brand?' }).getByRole('button', { name: 'Delete brand' }).click()
      await expect(page.getByRole('button', { name: 'Delete Trail Stove' })).toHaveCount(0)
      await expect(page.getByRole('searchbox', { name: 'Search brands' })).toBeFocused()

      expect(brands).toEqual([{
        id: 10,
        name: 'MSR',
        slug: 'msr'
      }])
    })
  })

  test('shows loading, retry, empty, and failed mutation states', async ({ context, page }) => {
    const firstLoad = createDeferred()
    const retryLoad = createDeferred()

    await mockRecoveringBrands(context, firstLoad.promise, retryLoad.promise)

    await signIn({
      context,
      page,
      isAdmin: true,
      target: '/admin'
    })

    await test.step('block creation while loading and keep search focused during keyboard retry', async () => {
      const addBrand = page.getByRole('button', { name: 'Add brand' })
      const search = page.getByRole('searchbox', { name: 'Search brands' })

      await page.getByRole('link', { name: 'Manage brands' }).click()
      await expect(page.getByText('Loading brands')).toBeVisible()
      await expect(addBrand).toBeDisabled()
      firstLoad.resolve()
      await expect(page.getByText('Brands unavailable.')).toBeVisible()

      const retry = page.getByRole('button', { name: 'Retry' })

      await retry.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByText('Loading brands')).toBeVisible()
      await expect(addBrand).toBeDisabled()
      await expect(search).toBeFocused()
      retryLoad.resolve()
      await expect(page.getByText('No brands yet.')).toBeVisible()
      await expect(search).toBeFocused()
      await expect(addBrand).toBeEnabled()
    })

    await test.step('preserve a custom slug after editing the name and a rejected creation', async () => {
      await page.getByRole('button', { name: 'Add brand' }).click()

      const dialog = await fillBrandDialog(page, 'Ångström')
      const nameInput = dialog.getByRole('textbox', { name: 'Name' })
      const slugInput = dialog.getByRole('textbox', { name: 'Slug' })

      await expect(slugInput).toHaveValue('angstrom')
      await slugInput.fill('custom-slug')
      await nameInput.fill('Ångström Plus')
      await expect(slugInput).toHaveValue('custom-slug')

      const createRequest = page.waitForRequest(isCreateBrandRequest)

      await dialog.getByRole('button', { name: 'Create brand' }).click()

      const request = await createRequest
      const rawBody: unknown = request.postDataJSON()
      const body = v.parse(brandBodySchema, rawBody)

      expect(body).toEqual({
        name: 'Ångström Plus',
        slug: 'custom-slug'
      })

      await expect(dialog.getByRole('alert')).toHaveText('Brand slug already exists')
      await expect(nameInput).toHaveValue('Ångström Plus')
      await expect(slugInput).toHaveValue('custom-slug')
      await expect(slugInput).toHaveAttribute('aria-invalid', 'true')
      await expect(slugInput).toHaveAccessibleDescription(/Brand slug already exists/u)
      await expect(slugInput).toBeEnabled()
      await expect(slugInput).toBeFocused()
    })

    await test.step('link custom and server name errors to the retained name field', async () => {
      const dialog = page.getByRole('dialog', { name: 'Add brand' })
      const nameInput = dialog.getByRole('textbox', { name: 'Name' })
      const slugInput = dialog.getByRole('textbox', { name: 'Slug' })

      await nameInput.fill('   ')
      await dialog.getByRole('button', { name: 'Create brand' }).click()
      await expect(dialog.getByRole('alert')).toHaveText('Enter a name.')
      await expect(nameInput).toHaveAttribute('aria-invalid', 'true')
      await expect(nameInput).toHaveAccessibleDescription('Enter a name.')
      await expect(nameInput).toBeFocused()
      await nameInput.fill('Ångström Plus')
      await dialog.getByRole('button', { name: 'Create brand' }).click()
      await expect(dialog.getByRole('alert')).toHaveText('Brand name already exists')
      await expect(nameInput).toHaveValue('Ångström Plus')
      await expect(nameInput).toHaveAttribute('aria-invalid', 'true')
      await expect(nameInput).toHaveAccessibleDescription('Brand name already exists')
      await expect(nameInput).toBeEnabled()
      await expect(nameInput).toBeFocused()
      await expect(slugInput).toHaveValue('custom-slug')
      await expect(slugInput).not.toHaveAttribute('aria-invalid', 'true')
    })
  })

  test('keeps a failed delete open and allows a retry', async ({ context, page }) => {
    await mockBrandStore(context, [{
      id: 10,
      name: 'MSR',
      slug: 'msr'
    }])

    const getAttempts = await mockRetryDelete(context)

    await signIn({
      context,
      page,
      isAdmin: true
    })

    await page.getByRole('button', { name: 'Delete MSR' }).click()

    const dialog = page.getByRole('dialog', { name: 'Delete brand?' })

    await dialog.getByRole('button', { name: 'Delete brand' }).click()
    await expect(dialog.getByRole('alert')).toContainText('used by gear')
    await dialog.getByRole('button', { name: 'Delete brand' }).click()
    await expect(page.getByRole('button', { name: 'Delete MSR' })).toHaveCount(0)

    const attempts = getAttempts()

    expect(attempts).toBe(2)
  })

  test('fits the create dialog on a narrow screen and blocks duplicate pending saves', async ({ context, page }) => {
    const pending = createDeferred()
    const getCreates = await mockPendingBrandCreate(context, pending.promise)

    await signIn({
      context,
      page,
      isAdmin: true
    })

    await page.setViewportSize({
      width: 320,
      height: 720
    })

    await page.getByRole('button', { name: 'Add brand' }).click()

    const dialog = await fillBrandDialog(page, 'MSR')

    await test.step('keep the form inside the dialog and the narrow viewport', async () => {
      const dialogGeometry = await dialog.evaluate((element) => {
        const rectangle = element.getBoundingClientRect()
        const { documentElement } = globalThis.document
        const contentLeft = rectangle.left + element.clientLeft
        const contentRight = contentLeft + element.clientWidth

        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: rectangle.left,
          right: rectangle.right,
          contentLeft,
          contentRight,
          documentWidth: documentElement.scrollWidth,
          viewportWidth: documentElement.clientWidth
        }
      })

      const formGeometry = await dialog.locator('form').evaluate((element) => {
        const rectangle = element.getBoundingClientRect()

        return {
          left: rectangle.left,
          right: rectangle.right
        }
      })

      expect(dialogGeometry.scrollWidth).toBe(dialogGeometry.clientWidth)
      expect(dialogGeometry.left).toBeGreaterThanOrEqual(0)
      expect(dialogGeometry.right).toBeLessThanOrEqual(dialogGeometry.viewportWidth)
      expect(dialogGeometry.documentWidth).toBeLessThanOrEqual(dialogGeometry.viewportWidth)
      expect(formGeometry.left).toBeGreaterThanOrEqual(dialogGeometry.contentLeft)
      expect(formGeometry.right).toBeLessThanOrEqual(dialogGeometry.contentRight)
      await expect(dialog.getByRole('textbox', { name: 'Slug' })).toBeInViewport()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeInViewport()
      await expect(dialog.getByRole('button', { name: 'Create brand' })).toBeInViewport()
    })

    await test.step('disable repeated actions until the pending creation completes', async () => {
      const createRequest = page.waitForRequest(isCreateBrandRequest)

      await dialog.getByRole('button', { name: 'Create brand' }).click()

      await createRequest

      await expect(dialog.getByRole('button', { name: 'Create brand' })).toBeDisabled()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeDisabled()
      await expect.poll(getCreates).toBe(1)
      pending.resolve()
      await expect(page.getByRole('button', { name: 'Edit MSR' })).toBeVisible()
    })
  })
})
