import type { BrowserContext, Page, Request, Route } from '@playwright/test'
import * as v from 'valibot'
import type { CategoriesListResponse } from '../../../server/api/equipment/categories/index.get.ts'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { createDeferred, mockCatalogApi } from '../fixtures/gear-library-entry-list.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'

const adminId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const path = '/admin/equipment/categories'
const apiPath = '/api/equipment/categories'

type Category = CategoriesListResponse[number]

interface SignInOptions {
  context: BrowserContext;
  isAdmin: boolean;
  page: Page;
  target?: string;
}

const categoryBodySchema = v.object({
  name: v.string(),
  slug: v.string()
})

function isCreateCategoryRequest(request: Request): boolean {
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

async function mockCategoryStore(context: BrowserContext, initial: Category[] = []) {
  const categories = [...initial]
  const itemPathPrefix = `${apiPath}/`
  let nextId = 20

  await context.route((url) => {
    const isItemPath = url.pathname.startsWith(itemPathPrefix)
    const isCategoryPath = url.pathname === apiPath || isItemPath

    return isCategoryPath
  }, async (route) => {
    const request = route.request()
    const requestUrl = request.url()
    const { pathname } = new globalThis.URL(requestUrl)
    const method = request.method()
    const isListRequest = pathname === apiPath && method === 'GET'
    const isCreateRequest = pathname === apiPath && method === 'POST'

    if (isListRequest) {
      await route.fulfill({ json: categories })

      return
    }

    if (isCreateRequest) {
      const rawBody: unknown = request.postDataJSON()
      const body = v.parse(categoryBodySchema, rawBody)

      const category = {
        id: nextId,
        name: body.name,
        slug: body.slug
      }

      nextId += 1

      categories.push(category)

      await route.fulfill({
        status: 201,
        json: category
      })

      return
    }

    const detailPathPrefix = `${apiPath}/by-slug/`
    const isDetailRequest = pathname.startsWith(detailPathPrefix) && method === 'GET'

    if (isDetailRequest) {
      const slug = pathname.slice(detailPathPrefix.length)
      const category = categories.find((entry) => entry.slug === slug)

      if (category === undefined) {
        await route.fulfill({
          status: 404,
          json: { statusCode: 404 }
        })

        return
      }

      await route.fulfill({ json: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        properties: []
      } })

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
    const index = categories.findIndex((category) => category.id === id)

    if (index === -1) {
      await route.fulfill({
        status: 404,
        json: { statusCode: 404 }
      })

      return
    }

    if (method === 'PATCH') {
      const rawBody: unknown = request.postDataJSON()
      const body = v.parse(categoryBodySchema, rawBody)

      const category = {
        id,
        name: body.name,
        slug: body.slug
      }

      categories[index] = category

      await route.fulfill({ json: category })

      return
    }

    categories.splice(index, 1)

    await route.fulfill({
      status: 204,
      body: ''
    })
  })

  return categories
}

async function fillCategoryDialog(page: Page, name: string, slug?: string) {
  const dialog = page.getByRole('dialog', { name: /category/u })

  await dialog.getByRole('textbox', { name: 'Name' }).fill(name)

  if (slug !== undefined) {
    await dialog.getByRole('textbox', { name: 'Slug' }).fill(slug)
  }

  return dialog
}

async function mockRecoveringCategories(context: BrowserContext, firstLoad: Promise<void>, retryLoad: Promise<void>) {
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

    if (creates <= 2) {
      const status = creates === 1 ? 409 : 500
      const statusMessage = creates === 1 ? 'Category slug already exists' : 'Private database failure'

      await route.fulfill({
        status,

        json: {
          statusCode: status,
          statusMessage
        }
      })

      return
    }

    const rawBody: unknown = request.postDataJSON()
    const body = v.parse(categoryBodySchema, rawBody)

    await route.fulfill({
      status: 201,

      json: {
        id: 20,
        name: body.name,
        slug: body.slug
      }
    })
  })

  return () => creates
}

async function mockCategoryConflict(context: BrowserContext) {
  await context.route('**/api/equipment/categories{,/*}', async (route) => {
    const request = route.request()
    const method = request.method()

    if (method !== 'POST' && method !== 'PATCH') {
      await route.fallback()

      return
    }

    await route.fulfill({
      status: 409,

      json: {
        statusCode: 409,
        statusMessage: 'Category slug already exists'
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
          statusMessage: 'Category is used by equipment'
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

async function mockPendingCategoryCreate(context: BrowserContext, release: Promise<void>) {
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
        name: 'Tents',
        slug: 'tents'
      }
    })
  })

  return () => creates
}

test.describe('Admin category management', () => {
  test('guards the page before category data loads', async ({ context, page }) => {
    let categoryRequests = 0

    page.on('request', (request) => {
      const requestUrl = request.url()
      const url = new globalThis.URL(requestUrl)
      const isCategoryRequest = url.pathname === apiPath
      const requestCount = Number(isCategoryRequest)

      categoryRequests += requestCount
    })

    await page.goto(path)
    await expect(page).toHaveURL(/\/login\?redirectTo=/u)
    expect(categoryRequests).toBe(0)

    await signIn({
      context,
      page,
      isAdmin: false
    })

    await expect(page).toHaveURL(/\/$/u)
    expect(categoryRequests).toBe(0)
  })

  test('creates, edits, searches, and deletes a category by id', async ({ context, page }) => {
    await mockCatalogApi(context)

    const categories = await mockCategoryStore(context, [{
      id: 10,
      name: 'Tents',
      slug: 'tents'
    }])

    await test.step('open the category workspace from Admin', async () => {
      await signIn({
        context,
        page,
        isAdmin: true,
        target: '/admin'
      })

      const pathPattern = `${path}$`
      const expectedUrl = new RegExp(pathPattern, 'u')

      await page.getByRole('link', { name: 'Manage categories' }).click()
      await expect(page).toHaveURL(expectedUrl)
      await expect(page).toHaveTitle('Manage categories')
      await expect(page.getByRole('main')).toHaveCount(1)
      await expect(page.getByRole('main').getByRole('searchbox', { name: 'Search categories' })).toBeVisible()
    })

    await test.step('create a category with its suggested slug', async () => {
      await page.getByRole('button', { name: 'Add category' }).click()

      const createDialog = await fillCategoryDialog(page, 'Tentes été')

      await expect(createDialog.getByRole('textbox', { name: 'Slug' })).toHaveValue('tentes-ete')
      await createDialog.getByRole('button', { name: 'Create category' }).click()
      await expect(page.getByRole('status')).toContainText('Tentes été created.')
      await expect(page.getByText('tentes-ete')).toBeVisible()
    })

    await test.step('reload and sign in again to read the saved category', async () => {
      await page.reload()
      await expect(page).toHaveURL(/\/login\?redirectTo=/u)

      await signIn({
        context,
        page,
        isAdmin: true
      })

      await expect(page.getByRole('button', { name: 'Edit Tentes été' })).toBeVisible()
    })

    await test.step('edit the same category and search the updated list', async () => {
      await page.getByRole('button', { name: 'Edit Tentes été' }).click()

      const editDialog = await fillCategoryDialog(page, 'Tentes été Plus')

      await expect(editDialog.getByRole('textbox', { name: 'Slug' })).toHaveValue('tentes-ete')
      await editDialog.getByRole('textbox', { name: 'Slug' }).fill('tentes-ete-plus')
      await editDialog.getByRole('button', { name: 'Save category' }).click()
      await expect(page.getByRole('button', { name: 'Edit Tentes été Plus' })).toBeVisible()

      const updatedCategory = categories.find((category) => category.id === 20)

      expect(updatedCategory?.slug).toBe('tentes-ete-plus')
      await page.getByRole('searchbox', { name: 'Search categories' }).fill('missing')
      await expect(page.getByRole('heading', { name: 'No matching categories.' })).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('No matching categories.')
      await expect(page.getByRole('searchbox', { name: 'Search categories' })).toBeFocused()
      await page.getByRole('searchbox', { name: 'Search categories' }).fill('ÉTÉ')
      await expect(page.getByRole('button', { name: 'Edit Tents' })).toHaveCount(0)
    })

    await test.step('reload the edited category and use it in catalog and submission selectors', async () => {
      await page.reload()
      await expect(page).toHaveURL(/\/login\?redirectTo=/u)

      await signIn({
        context,
        page,
        isAdmin: true
      })

      await expect(page.getByRole('button', { name: 'Edit Tentes été Plus' })).toBeVisible()
      await expect(page.getByText('tentes-ete-plus', { exact: true })).toBeVisible()

      await page.getByRole('navigation', { name: 'Workspace navigation' })
        .getByRole('link', { name: 'Gear library' }).click()

      const catalogCategory = page.getByRole('combobox', { name: /^Category/u })

      await catalogCategory.click()
      await expect(page.getByRole('option', { name: 'Tentes été Plus' })).toBeVisible()
      await page.keyboard.press('Escape')
      await page.getByRole('link', { name: 'Submit gear' }).click()

      const categorySelect = page.getByRole('combobox', { name: /^Category/u })

      await categorySelect.click()
      await page.getByRole('option', { name: 'Tentes été Plus' }).click()
      await expect(categorySelect).toContainText('Tentes été Plus')
      await expect(page.getByRole('alert')).toHaveCount(0)
    })

    await test.step('restore search focus when a rename removes the matching row', async () => {
      await page.getByRole('navigation', { name: 'Workspace navigation' })
        .getByRole('link', { name: 'Admin' }).click()

      await page.getByRole('link', { name: 'Manage categories' }).click()
      await page.getByRole('searchbox', { name: 'Search categories' }).fill('ÉTÉ')
      await page.getByRole('button', { name: 'Edit Tentes été Plus' }).click()

      const renameDialog = await fillCategoryDialog(page, 'Shelters')

      await renameDialog.getByRole('button', { name: 'Save category' }).click()
      await expect(page.getByRole('heading', { name: 'No matching categories.' })).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('Shelters updated.')
      await expect(page.getByRole('searchbox', { name: 'Search categories' })).toBeFocused()
    })

    await test.step('delete the category by its stable id and restore search focus', async () => {
      await page.getByRole('searchbox', { name: 'Search categories' }).fill('')
      await page.getByRole('button', { name: 'Delete Shelters' }).click()
      await page.getByRole('dialog', { name: 'Delete category?' }).getByRole('button', { name: 'Delete category' }).click()
      await expect(page.getByRole('button', { name: 'Delete Shelters' })).toHaveCount(0)
      await expect(page.getByRole('searchbox', { name: 'Search categories' })).toBeFocused()

      expect(categories).toEqual([{
        id: 10,
        name: 'Tents',
        slug: 'tents'
      }])
    })
  })

  test('shows loading, retry, empty, and failed mutation states', async ({ context, page }) => {
    const firstLoad = createDeferred()
    const retryLoad = createDeferred()
    const getCreates = await mockRecoveringCategories(context, firstLoad.promise, retryLoad.promise)

    await signIn({
      context,
      page,
      isAdmin: true,
      target: '/admin'
    })

    await test.step('block creation while loading and keep search focused during keyboard retry', async () => {
      const addCategory = page.getByRole('button', { name: 'Add category' })
      const search = page.getByRole('searchbox', { name: 'Search categories' })

      await page.getByRole('link', { name: 'Manage categories' }).click()
      await expect(page.getByRole('heading', { name: 'Loading categories' })).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('Loading categories.')
      await expect(addCategory).toBeDisabled()
      firstLoad.resolve()
      await expect(page.getByText('Categories unavailable.')).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('The category list could not be loaded.')
      await expect(addCategory).toBeDisabled()

      const retry = page.getByRole('button', { name: 'Retry' })

      await retry.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { name: 'Loading categories' })).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('Loading categories.')
      await expect(addCategory).toBeDisabled()
      await expect(search).toBeFocused()
      retryLoad.resolve()
      await expect(page.getByRole('heading', { name: 'No categories yet.' })).toBeVisible()
      await expect(page.getByRole('status')).toHaveText('No categories yet.')
      await expect(search).toBeFocused()
      await expect(addCategory).toBeEnabled()
    })

    await test.step('preserve a custom slug after editing the name and a rejected creation', async () => {
      await page.getByRole('button', { name: 'Add category' }).click()

      const dialog = await fillCategoryDialog(page, 'Ångström')
      const nameInput = dialog.getByRole('textbox', { name: 'Name' })
      const slugInput = dialog.getByRole('textbox', { name: 'Slug' })

      await expect(slugInput).toHaveValue('angstrom')
      await slugInput.fill('custom-slug')
      await nameInput.fill('Ångström Plus')
      await expect(slugInput).toHaveValue('custom-slug')

      const createRequest = page.waitForRequest(isCreateCategoryRequest)

      await dialog.getByRole('button', { name: 'Create category' }).click()

      const request = await createRequest
      const rawBody: unknown = request.postDataJSON()
      const body = v.parse(categoryBodySchema, rawBody)

      expect(body).toEqual({
        name: 'Ångström Plus',
        slug: 'custom-slug'
      })

      await expect(dialog.getByRole('alert')).toHaveText('Category slug already exists')
      await expect(nameInput).toHaveValue('Ångström Plus')
      await expect(slugInput).toHaveValue('custom-slug')
      await expect(slugInput).toHaveAttribute('aria-invalid', 'true')
      await expect(slugInput).toHaveAccessibleDescription(/Category slug already exists/u)
      await expect(slugInput).toBeEnabled()
      await expect(slugInput).toBeFocused()
      await nameInput.fill('Ångström Updated')
      await expect(slugInput).toHaveValue('custom-slug')
      await expect(dialog.getByRole('alert')).toHaveText('Category slug already exists')
      await expect(slugInput).toHaveAttribute('aria-invalid', 'true')
      await expect(slugInput).toHaveAccessibleDescription(/Category slug already exists/u)
      await slugInput.fill('corrected-slug')
      await expect(slugInput).not.toHaveAttribute('aria-invalid', 'true')
      await expect(slugInput).not.toHaveAccessibleDescription(/Category slug already exists/u)
      await expect(dialog.getByRole('alert')).toHaveCount(0)
    })

    await test.step('retain invalid input, then recover from a failed save', async () => {
      const dialog = page.getByRole('dialog', { name: 'Add category' })
      const nameInput = dialog.getByRole('textbox', { name: 'Name' })
      const slugInput = dialog.getByRole('textbox', { name: 'Slug' })

      await nameInput.fill('   ')
      await dialog.getByRole('button', { name: 'Create category' }).click()
      await expect(dialog.getByRole('alert')).toHaveText('Enter a name.')
      await expect(nameInput).toHaveAttribute('aria-invalid', 'true')
      await expect(nameInput).toHaveAccessibleDescription('Enter a name.')
      await expect(nameInput).toBeFocused()
      await nameInput.fill('Ångström Plus')
      await expect(nameInput).not.toHaveAttribute('aria-invalid', 'true')
      await expect(dialog.getByRole('alert')).toHaveCount(0)
      await slugInput.fill('')
      await dialog.getByRole('button', { name: 'Create category' }).click()
      await expect(slugInput).toBeFocused()
      expect(getCreates()).toBe(1)
      await slugInput.fill('Bad Slug')
      await dialog.getByRole('button', { name: 'Create category' }).click()
      await expect(slugInput).toBeFocused()
      await expect(slugInput).toHaveValue('Bad Slug')
      await expect(nameInput).toHaveValue('Ångström Plus')
      expect(getCreates()).toBe(1)
      await slugInput.fill('corrected-slug')
      await dialog.getByRole('button', { name: 'Create category' }).click()
      await expect(dialog.getByRole('alert')).toHaveText('Could not save the category. Try again.')
      await expect(dialog.getByRole('alert')).toBeFocused()
      await expect(slugInput).toHaveValue('corrected-slug')
      await expect(nameInput).toHaveValue('Ångström Plus')
      await nameInput.fill('Ångström Restored')
      await expect(dialog.getByRole('alert')).toHaveCount(0)
      await nameInput.fill('Ångström Plus')
      await dialog.getByRole('button', { name: 'Create category' }).click()
      await expect(page.getByRole('button', { name: 'Edit Ångström Plus' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add category' })).toBeFocused()
      expect(getCreates()).toBe(3)
    })
  })

  test('keeps a slug conflict until its value changes', async ({ context, page }) => {
    await mockCategoryStore(context, [{
      id: 10,
      name: 'Tents',
      slug: 'tents'
    }])

    await mockCategoryConflict(context)

    await signIn({
      context,
      page,
      isAdmin: true
    })

    await page.getByRole('button', { name: 'Add category' }).click()

    const createDialog = await fillCategoryDialog(page, 'Tents')
    const createName = createDialog.getByRole('textbox', { name: 'Name' })
    const createSlug = createDialog.getByRole('textbox', { name: 'Slug' })

    await createDialog.getByRole('button', { name: 'Create category' }).click()
    await expect(createSlug).toHaveAttribute('aria-invalid', 'true')
    await createName.fill('Tents!')
    await expect(createSlug).toHaveValue('tents')
    await expect(createDialog.getByRole('alert')).toHaveText('Category slug already exists')
    await expect(createSlug).toHaveAttribute('aria-invalid', 'true')
    await expect(createSlug).toHaveAccessibleDescription(/Category slug already exists/u)
    await createName.fill('Shelters')
    await expect(createSlug).toHaveValue('shelters')
    await expect(createSlug).not.toHaveAttribute('aria-invalid', 'true')
    await expect(createSlug).not.toHaveAccessibleDescription(/Category slug already exists/u)
    await expect(createDialog.getByRole('alert')).toHaveCount(0)
    await createDialog.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Edit Tents' }).click()

    const editDialog = page.getByRole('dialog', { name: 'Edit category' })
    const editSlug = editDialog.getByRole('textbox', { name: 'Slug' })

    await editDialog.getByRole('button', { name: 'Save category' }).click()
    await expect(editSlug).toHaveAttribute('aria-invalid', 'true')
    await editDialog.getByRole('textbox', { name: 'Name' }).fill('Shelters')
    await expect(editSlug).toHaveValue('tents')
    await expect(editDialog.getByRole('alert')).toHaveText('Category slug already exists')
    await expect(editSlug).toHaveAttribute('aria-invalid', 'true')
    await expect(editSlug).toHaveAccessibleDescription(/Category slug already exists/u)
    await editSlug.fill('shelters')
    await expect(editSlug).not.toHaveAttribute('aria-invalid', 'true')
    await expect(editDialog.getByRole('alert')).toHaveCount(0)
  })

  test('announces a failed retry while search keeps focus', async ({ context, page }) => {
    const retryLoad = createDeferred()

    await context.route((url) => url.pathname === apiPath, async (route) => {
      await route.fulfill({
        status: 500,
        json: { statusCode: 500 }
      })
    })

    await signIn({
      context,
      page,
      isAdmin: true
    })

    await expect(page.getByRole('heading', { name: 'Categories unavailable.' })).toBeVisible()

    await context.route((url) => url.pathname === apiPath, async (route) => {
      await retryLoad.promise

      await route.fulfill({
        status: 500,
        json: { statusCode: 500 }
      })
    })

    const search = page.getByRole('searchbox', { name: 'Search categories' })

    await page.getByRole('button', { name: 'Retry' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toHaveText('Loading categories.')
    await expect(search).toBeFocused()
    retryLoad.resolve()
    await expect(page.getByRole('status')).toHaveText('The category list could not be loaded.')
    await expect(search).toBeFocused()
  })

  test('wraps long category text and keeps actions inside a narrow screen', async ({ context, page }) => {
    const name = 'ДлинноеНазваниеКатегории'.repeat(2)
    const slugPrefix = 'long-category-slug-'.repeat(3)
    const slug = `${slugPrefix}end`
    const editLabel = `Edit ${name}`
    const deleteLabel = `Delete ${name}`

    await mockCategoryStore(context, [{
      id: 10,
      name,
      slug
    }])

    await page.setViewportSize({
      width: 320,
      height: 720
    })

    await signIn({
      context,
      page,
      isAdmin: true
    })

    const row = page.getByRole('listitem').filter({ hasText: name })

    const geometry = await row.evaluate((element) => {
      const { documentElement } = globalThis.document
      const children = element.querySelectorAll('strong, span, button')

      const rectangles = [...children].map((child) => {
        const rectangle = child.getBoundingClientRect()

        return {
          left: rectangle.left,
          right: rectangle.right
        }
      })

      return {
        rectangles,
        documentWidth: documentElement.scrollWidth,
        viewportWidth: documentElement.clientWidth
      }
    })

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth)

    for (const rectangle of geometry.rectangles) {
      expect(rectangle.left).toBeGreaterThanOrEqual(0)
      expect(rectangle.right).toBeLessThanOrEqual(geometry.viewportWidth)
    }

    await expect(row.getByRole('button', { name: editLabel })).toBeInViewport()
    await expect(row.getByRole('button', { name: deleteLabel })).toBeInViewport()
  })

  test('keeps a failed delete open and allows a retry', async ({ context, page }) => {
    await mockCategoryStore(context, [{
      id: 10,
      name: 'Tents',
      slug: 'tents'
    }])

    const getAttempts = await mockRetryDelete(context)

    await signIn({
      context,
      page,
      isAdmin: true
    })

    await page.getByRole('button', { name: 'Delete Tents' }).click()

    const dialog = page.getByRole('dialog', { name: 'Delete category?' })

    await expect(dialog).toContainText('Its properties and their options will also be deleted.')
    await expect(dialog).toContainText('including pending and rejected submissions')
    await dialog.getByRole('button', { name: 'Delete category' }).click()
    await expect(dialog.getByRole('alert')).toContainText('used by gear')
    await dialog.getByRole('button', { name: 'Delete category' }).click()
    await expect(page.getByRole('button', { name: 'Delete Tents' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'No categories yet.' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Tents deleted.')

    const attempts = getAttempts()

    expect(attempts).toBe(2)
  })

  test('fits the create dialog on a narrow screen and blocks duplicate pending saves', async ({ context, page }) => {
    const pending = createDeferred()
    const getCreates = await mockPendingCategoryCreate(context, pending.promise)

    await signIn({
      context,
      page,
      isAdmin: true
    })

    await page.setViewportSize({
      width: 320,
      height: 720
    })

    await page.getByRole('button', { name: 'Add category' }).click()

    const dialog = await fillCategoryDialog(page, 'Tents')

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
      await expect(dialog.getByRole('button', { name: 'Create category' })).toBeInViewport()
    })

    await test.step('disable repeated actions until the pending creation completes', async () => {
      const createRequest = page.waitForRequest(isCreateCategoryRequest)

      await dialog.getByRole('button', { name: 'Create category' }).click()

      await createRequest

      await expect(dialog.getByRole('button', { name: 'Create category' })).toBeDisabled()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      await expect(dialog.getByRole('textbox', { name: 'Name' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()

      await dialog.locator('form').evaluate((form: HTMLFormElement) => {
        form.requestSubmit()
      })

      await expect.poll(getCreates).toBe(1)
      pending.resolve()
      await expect(page.getByRole('button', { name: 'Edit Tents' })).toBeVisible()
    })
  })
})
