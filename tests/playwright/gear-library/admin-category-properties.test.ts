import type { BrowserContext, Locator, Page, Request } from '@playwright/test'
import * as v from 'valibot'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'

import {
  categoryPropertiesOrderSchema,
  categoryPropertyDeleteQuerySchema,
  categoryPropertyMutationSchema,
  categoryPropertyUpdateSchema,
  propertiesRevisionQuerySchema,
  propertyEnumOptionRevisionMutationSchema
} from '#server/utils/validation/schemas'

import { expect, test } from '../fixtures/global.fixtures.ts'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'
import { createDeferred, selectPerdOption } from '../fixtures/gear-library-entry-list.fixtures.ts'

function requireFirst<Value>(values: Value[]): Value {
  const [value] = values

  if (value === undefined) { throw new Error('Missing test data') }

  return value
}
function requireBounds<Value>(value: Value | null): Value {
  if (value === null) { throw new Error('Expected visible bounds') }

  return value
}

const pagePath = '/admin/equipment/categories/2/properties'
const apiPath = '/api/equipment/categories/2/properties'

const initialSnapshot: AdminCategoryPropertiesSnapshot = {
  category: {
    id: 2,
    name: 'Sleeping Bags',
    slug: 'sleeping-bags',
    propertiesRevision: 0
  },

  properties: [
    {
      id: 11,
      name: 'Temperature rating',
      slug: 'temperature',
      dataType: 'number',
      unit: 'C',
      allowsNegativeValues: true,
      displayOrder: 0,
      usedItemCount: 1,
      negativeValueCount: 1,
      enumOptions: []
    },
    {
      id: 12,
      name: 'Fill type',
      slug: 'fill',
      dataType: 'enum',
      unit: null,
      allowsNegativeValues: false,
      displayOrder: 1,
      usedItemCount: 3,
      negativeValueCount: 0,

      enumOptions: [{
        id: 21,
        name: 'Down',
        slug: 'down',
        usedItemCount: 3
      }, {
        id: 22,
        name: 'Synthetic',
        slug: 'synthetic',
        usedItemCount: 0
      }]
    }
  ]
}

interface Store {
  snapshot: AdminCategoryPropertiesSnapshot;
  writes: Request[];
  failNext: boolean;
  changeDeleteCount: boolean;
  failRead: boolean;
  readGate: Promise<void> | null;
  gate: Promise<void> | null;
}

async function mockStore(context: BrowserContext): Promise<Store> {
  const store: Store = {
    snapshot: globalThis.structuredClone(initialSnapshot),
    writes: [],
    failNext: false,
    changeDeleteCount: false,
    failRead: false,
    readGate: null,
    gate: null
  }

  let nextId = 30

  // oxlint-disable-next-line complexity -- The stateful HTTP mock dispatches the characteristic and option methods.
  await context.route((url) => url.pathname.startsWith(apiPath), async (route) => {
    const request = route.request()
    const requestUrl = request.url()
    const url = new globalThis.URL(requestUrl)
    const method = request.method()

    if (method === 'GET') {
      if (store.readGate !== null) { await store.readGate }

      const response = store.failRead ? {
        status: 503,
        json: { statusCode: 503 }
      } : { json: store.snapshot }

      await route.fulfill(response)

      return
    }

    store.writes.push(request)

    if (store.gate !== null) { await store.gate }

    if (store.failNext) {
      store.failNext = false

      await route.fulfill({
        status: 503,
        json: { statusCode: 503 }
      })

      return
    }

    const raw: unknown = method === 'DELETE' ? Object.fromEntries(url.searchParams) : request.postDataJSON()
    const revisionSchema = method === 'DELETE' ? propertiesRevisionQuerySchema : v.object({ expectedPropertiesRevision: v.number() })
    const revision = v.parse(revisionSchema, raw)

    if (method === 'DELETE') {
      expect(request.postData()).toBeNull()
    }

    if (revision.expectedPropertiesRevision !== store.snapshot.category.propertiesRevision) {
      await route.fulfill({
        status: 409,

        json: {
          statusCode: 409,
          data: { code: 'properties_revision_conflict' }
        }
      })

      return
    }

    const suffix = url.pathname.slice(apiPath.length)
    const segments = suffix.split('/')
    const parts = segments.filter(Boolean)
    const propertyId = Number(parts[0])
    const property = store.snapshot.properties.find((entry) => entry.id === propertyId)

    if (suffix === '/order') {
      const body = v.parse(categoryPropertiesOrderSchema, raw)

      store.snapshot.properties = body.propertyIds.map((id, index) => {
        const entry = store.snapshot.properties.find((candidate) => candidate.id === id)

        if (entry === undefined) { throw new Error('Missing order ID') }

        entry.displayOrder = index

        return entry
      })
    } else if (suffix === '' && method === 'POST') {
      const body = v.parse(categoryPropertyMutationSchema, raw)

      nextId += 1

      const createdId = nextId

      const options = body.enumOptions?.map((option) => {
        nextId += 1

        return {
          id: nextId,
          name: option.name,
          slug: option.slug,
          usedItemCount: 0
        }
      }) ?? []

      store.snapshot.properties.push({
        id: createdId,
        name: body.name,
        slug: body.slug,
        dataType: body.dataType,
        unit: body.unit ?? null,
        allowsNegativeValues: body.allowsNegativeValues,
        displayOrder: store.snapshot.properties.length,
        usedItemCount: 0,
        negativeValueCount: 0,
        enumOptions: options
      })
    } else if (property !== undefined && parts[1] === 'enum-options') {
      const optionId = Number(parts[2])

      if (method === 'DELETE') {
        property.enumOptions = property.enumOptions.filter((option) => option.id !== optionId)
      } else {
        const body = v.parse(propertyEnumOptionRevisionMutationSchema, raw)
        const option = property.enumOptions.find((entry) => entry.id === optionId)

        if (option === undefined) {
          nextId += 1

          property.enumOptions.push({
            id: nextId,
            name: body.name,
            slug: body.slug,
            usedItemCount: 0
          })
        } else {
          option.name = body.name
          option.slug = body.slug
        }
      }
    } else if (property !== undefined && method === 'PATCH') {
      const body = v.parse(categoryPropertyUpdateSchema, raw)

      Object.assign(property, {
        name: body.name,
        slug: body.slug,
        dataType: body.dataType,
        unit: body.unit ?? null,
        allowsNegativeValues: body.allowsNegativeValues
      })
    } else if (property !== undefined && method === 'DELETE') {
      const query = v.parse(categoryPropertyDeleteQuerySchema, raw)

      if (store.changeDeleteCount) {
        store.changeDeleteCount = false
        property.usedItemCount += 1
      }

      if (query.expectedAffectedItemCount !== property.usedItemCount) {
        await route.fulfill({
          status: 409,

          json: {
            statusCode: 409,
            data: { code: 'affected_item_count_conflict' }
          }
        })

        return
      }

      store.snapshot.properties = store.snapshot.properties.filter((entry) => entry.id !== propertyId)
    } else { throw new Error(`Unexpected mutation ${method} ${url.pathname}`) }

    store.snapshot.category.propertiesRevision += 1

    await route.fulfill({
      status: method === 'POST' ? 201 : 200,
      json: store.snapshot
    })
  })

  await context.route((url) => url.pathname === '/api/equipment/categories', async (route) => {
    await route.fulfill({ json: [{
      id: 2,
      name: 'Sleeping Bags',
      slug: 'sleeping-bags'
    }] })
  })

  return store
}

async function signIn(context: BrowserContext, page: Page, isAdmin = true) {
  const user = {
    email: null,
    isAdmin,
    isGuest: false as const,
    userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
  }

  await mockAccountUser(context, {
    ...user,
    isTwitchLinked: true
  })

  await mockTwitchSignIn(context, page, {
    redirectTo: pagePath,
    user
  })
}
function row(scope: Page | Locator, name: string) {
  const page = 'page' in scope ? scope.page() : scope

  return scope.getByRole('listitem').filter({ has: page.getByRole('heading', {
    name,
    exact: true
  }) })
}

async function openOrder(page: Page) {
  await page.getByRole('button', {
    name: 'Reorder',
    exact: true
  }).click()

  const dialog = page.getByRole('dialog', { name: 'Reorder characteristics' })

  await expect(dialog).toBeVisible()

  await dialog.evaluate(async (element) => {
    const animations = element.getAnimations()

    const completionPromises = animations.map(async ({ finished }) => {
      await finished
    })

    await Promise.all(completionPromises)
  })

  await expect.poll(
    async () => dialog.evaluate((element) => globalThis.getComputedStyle(element).opacity)
  ).toBe('1')

  return dialog
}

async function openEditor(page: Page, name: string) {
  await row(page, name).getByRole('button', {
    name: `Edit ${name}`,
    exact: true
  }).click()

  const dialog = page.getByRole('dialog', { name: 'Edit characteristic' })

  await expect(dialog).toBeVisible()

  return dialog
}

async function requestDelete(page: Page, name: string) {
  await row(page, name).getByRole('button', {
    name: `Actions for ${name}`,
    exact: true
  }).click()

  await page.getByRole('menuitem', {
    name: 'Delete characteristic',
    exact: true
  }).click()
}

test.describe('admin category characteristics', () => {
  test('keeps an order draft after a conflict and requires cancel before reloading', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await expect(page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })).toHaveCount(0)

    const order = await openOrder(page)

    await row(order, 'Fill type').getByRole('button', {
      name: 'Move Fill type up',
      exact: true
    }).click()

    store.snapshot.category.propertiesRevision += 1

    await order.getByRole('button', {
      name: 'Save order',
      exact: true
    }).click()

    await expect(order.getByRole('alert')).toContainText('Your draft is still here.')
    await expect(order.getByRole('heading', { level: 3 })).toHaveText(['Fill type', 'Temperature rating'])

    await expect(order.getByRole('button', {
      name: 'Save order',
      exact: true
    })).toBeDisabled()

    await order.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    const reload = page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })

    await expect(reload).toBeEnabled()
    await reload.click()
    await expect(reload).toHaveCount(0)

    await expect(page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    })).toBeFocused()

    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Fill type'])
  })

  test('creates characteristics and enum options, edits stable IDs, cancels and saves order, and survives reload', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await test.step('Create an enum characteristic with its first option', async () => {
      await page.getByRole('button', {
        name: 'Add characteristic',
        exact: true
      }).click()

      const create = page.getByRole('dialog', { name: 'Add characteristic' })

      await create.getByLabel('Name', { exact: true }).fill('Insulation type')
      await expect(create.getByLabel('Slug', { exact: true })).toHaveValue('insulation-type')
      await selectPerdOption(create.getByRole('combobox', { name: /^Type/u }), 'enum')
      await create.getByLabel('Option 1 name').fill('Down')
      await expect(create.getByLabel('Option 1 slug')).toHaveValue('down')
      await create.getByRole('button', { name: 'Create characteristic' }).click()
    })

    const editor = await openEditor(page, 'Insulation type')

    await test.step('Add an option while preserving the characteristic draft', async () => {
      await expect(editor.getByText('Keep at least one option.')).toBeVisible()
      await editor.getByLabel('Name', { exact: true }).fill('Insulation material')

      await editor.getByRole('button', {
        name: 'Add option',
        exact: true
      }).click()

      await editor.getByLabel('Option name', { exact: true }).fill('Synthetic')
      await expect(editor.getByLabel('Option slug', { exact: true })).toHaveValue('synthetic')

      await expect(editor.getByRole('button', {
        name: 'Save characteristic',
        exact: true
      })).toBeDisabled()

      await editor.getByRole('button', {
        name: 'Create option',
        exact: true
      }).click()
    })

    await test.step('Rename an option without replacing its ID', async () => {
      await editor.getByRole('button', {
        name: 'Edit option Down',
        exact: true
      }).click()

      await editor.getByLabel('Option name', { exact: true }).fill('Duck down')
      await expect(editor.getByLabel('Option slug', { exact: true })).toHaveValue('down')
      await editor.getByLabel('Option slug', { exact: true }).fill('duck-down')

      await editor.getByRole('button', {
        name: 'Save option',
        exact: true
      }).click()

      await expect(editor.getByText('Duck down', { exact: true })).toBeVisible()
      await expect(editor.getByLabel('Name', { exact: true })).toHaveValue('Insulation material')
    })

    await test.step('Delete an unused option and keep the last option disabled', async () => {
      await editor.getByRole('button', {
        name: 'Actions for option Synthetic',
        exact: true
      }).click()

      await editor.getByRole('menuitem', {
        name: 'Delete option',
        exact: true
      }).click()

      await editor.getByRole('button', {
        name: 'Delete option',
        exact: true
      }).click()

      await expect(editor.getByRole('button', {
        name: 'Actions for option Synthetic',
        exact: true
      })).toHaveCount(0)

      await expect(editor.getByText('Keep at least one option.')).toBeVisible()

      const actions = editor.getByRole('button', {
        name: 'Actions for option Duck down',
        exact: true
      })

      await actions.focus()
      await page.keyboard.press('ArrowDown')

      const menu = editor.getByRole('menu', { name: 'Duck down option actions' })

      const deleteOption = menu.getByRole('menuitem', {
        name: 'Delete option',
        exact: true
      })

      await expect(deleteOption).toBeDisabled()
      await expect(deleteOption).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(menu).toBeVisible()
      await page.keyboard.press('Space')
      await expect(menu).toBeVisible()
      await deleteOption.click({ force: true })
      await expect(menu).toBeVisible()
      await expect(editor.getByRole('button', { name: 'Cancel deletion' })).toHaveCount(0)
      expect(store.writes).toHaveLength(4)
      await page.keyboard.press('Escape')
      await expect(actions).toBeFocused()
    })

    await test.step('Save the characteristic draft', async () => {
      await editor.getByRole('button', {
        name: 'Save characteristic',
        exact: true
      }).click()

      await expect(editor).not.toBeVisible()
    })

    await test.step('Cancel a changed order', async () => {
      const order = await openOrder(page)

      await row(order, 'Insulation material').getByRole('button', { name: 'Move Insulation material up' }).click()
      await expect(row(order, 'Insulation material')).toBeFocused()

      await order.getByRole('button', {
        name: 'Cancel',
        exact: true
      }).click()

      await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Fill type', 'Insulation material'])

      await expect(page.getByRole('button', {
        name: 'Reorder',
        exact: true
      })).toBeFocused()
    })

    await test.step('Save a new order and retain it after reload', async () => {
      const order = await openOrder(page)

      await row(order, 'Insulation material').getByRole('button', { name: 'Move Insulation material up' }).click()

      await order.getByRole('button', {
        name: 'Save order',
        exact: true
      }).click()

      await expect(order).not.toBeVisible()

      await expect(page.getByRole('button', {
        name: 'Reorder',
        exact: true
      })).toBeFocused()

      await page.reload()
      await signIn(context, page)
      await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Insulation material', 'Fill type'])
      expect(store.snapshot.category.propertiesRevision).toBe(6)
    })
  })

  test('explains used fields and keeps names editable without changing slugs', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await row(page, 'Temperature rating').getByRole('button', {
      name: 'Edit Temperature rating',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit characteristic' })

    await expect(dialog.getByRole('combobox', { name: /^Type/u })).toBeDisabled()
    await expect(dialog.getByLabel('Unit (optional)')).toBeDisabled()
    await expect(dialog.getByLabel('Allow negative values')).toBeDisabled()
    await expect(dialog.getByText('1 items have values. Type and unit cannot change.')).toBeVisible()
    await dialog.getByLabel('Name', { exact: true }).fill('Comfort temperature')
    await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue('temperature')
    await dialog.getByRole('button', { name: 'Save characteristic' }).click()

    const fill = await openEditor(page, 'Fill type')

    const actions = fill.getByRole('button', {
      name: 'Actions for option Down',
      exact: true
    })

    await actions.focus()
    await page.keyboard.press('Enter')

    const menu = fill.getByRole('menu', { name: 'Down option actions' })

    const deleteOption = menu.getByRole('menuitem', {
      name: 'Delete option',
      exact: true
    })

    await expect(deleteOption).toBeDisabled()
    await expect(deleteOption).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await page.keyboard.press('Space')
    await expect(menu).toBeVisible()
    await deleteOption.click({ force: true })
    await expect(menu).toBeVisible()
    await expect(fill.getByRole('button', { name: 'Cancel deletion' })).toHaveCount(0)
    expect(store.writes).toHaveLength(1)
    await page.keyboard.press('Escape')
    await expect(actions).toBeFocused()

    await fill.getByRole('button', {
      name: 'Edit option Down',
      exact: true
    }).click()

    await expect(fill.getByText('3 items use this option. Changing its slug also updates their saved choice.')).toBeVisible()
  })

  test('refreshes deletion counts and requires a second explicit confirmation', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)
    await requestDelete(page, 'Fill type')

    const dialog = page.getByRole('dialog', { name: 'Delete characteristic' })

    await expect(dialog).toContainText('3 items and deletes 2 enum options')

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    expect(store.writes).toHaveLength(0)
    await requestDelete(page, 'Fill type')

    store.changeDeleteCount = true

    await dialog.getByRole('button', {
      name: 'Delete characteristic',
      exact: true
    }).click()

    await expect(dialog).toContainText('4 items and deletes 2 enum options')
    await expect(dialog).toContainText('Review the new counts and confirm again.')
    expect(store.writes).toHaveLength(1)

    await dialog.getByRole('button', {
      name: 'Delete characteristic',
      exact: true
    }).click()

    await expect(dialog).not.toBeVisible()
    await expect(row(page, 'Fill type')).toHaveCount(0)
    expect(store.writes).toHaveLength(2)
  })

  test('returns focus after cancelling asynchronously loaded deletion details', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    const actions = row(page, 'Fill type').getByRole('button', {
      name: 'Actions for Fill type',
      exact: true
    })

    await expect(actions).toBeEnabled()

    const gate = createDeferred()

    store.readGate = gate.promise

    await requestDelete(page, 'Fill type')
    await expect(actions).toBeDisabled()
    gate.resolve()

    store.readGate = null

    const dialog = page.getByRole('dialog', { name: 'Delete characteristic' })

    await expect(dialog).toContainText('3 items and deletes 2 enum options')

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(dialog).not.toBeVisible()
    await expect(actions).toBeFocused()
    expect(store.writes).toHaveLength(0)
  })

  test('links initial option errors to their fields and focuses the first invalid option', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)
    await page.getByRole('button', { name: 'Add characteristic' }).click()

    const dialog = page.getByRole('dialog', { name: 'Add characteristic' })
    const submit = dialog.getByRole('button', { name: 'Create characteristic' })
    const firstSlug = dialog.getByLabel('Option 1 slug')
    const secondSlug = dialog.getByLabel('Option 2 slug')
    const secondName = dialog.getByLabel('Option 2 name')

    await dialog.getByLabel('Name', { exact: true }).fill('Insulation')
    await selectPerdOption(dialog.getByRole('combobox', { name: /^Type/u }), 'enum')

    await test.step('Associate the invalid slug error with its field', async () => {
      await dialog.getByLabel('Option 1 name').fill('Down')
      await firstSlug.fill('WRONG')
      await submit.click()
      await expect(firstSlug).toHaveAttribute('aria-invalid', 'true')
      await expect(firstSlug).toHaveAccessibleDescription('Use lowercase letters, numbers, and single hyphens.')
      await expect(firstSlug).toBeFocused()
      expect(store.writes).toHaveLength(0)
    })

    await test.step('Focus the duplicate option slug', async () => {
      await firstSlug.fill('down')
      await dialog.getByRole('button', { name: 'Add option' }).click()
      await secondName.fill('Synthetic')
      await secondSlug.fill('down')
      await submit.click()
      await expect(firstSlug).not.toHaveAttribute('aria-invalid', 'true')
      await expect(secondSlug).toHaveAttribute('aria-invalid', 'true')
      await expect(secondSlug).toHaveAccessibleDescription('Use a unique option slug.')
      await expect(secondSlug).toBeFocused()
      expect(store.writes).toHaveLength(0)
    })

    await test.step('Focus an empty option name and accept corrected values', async () => {
      await secondSlug.fill('synthetic')
      await secondName.fill('   ')
      await submit.click()
      await expect(secondSlug).not.toHaveAttribute('aria-invalid', 'true')
      await expect(secondName).toHaveAttribute('aria-invalid', 'true')
      await expect(secondName).toHaveAccessibleDescription('Enter an option name.')
      await expect(secondName).toBeFocused()
      expect(store.writes).toHaveLength(0)
      await secondName.fill('Synthetic')
      await submit.click()
      await expect(dialog).not.toBeVisible()
      await expect(row(page, 'Insulation')).toBeVisible()
      expect(store.writes).toHaveLength(1)
    })
  })

  test('focuses a surviving initial option after removing the focused row', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)
    await page.getByRole('button', { name: 'Add characteristic' }).click()

    const dialog = page.getByRole('dialog', { name: 'Add characteristic' })
    const removeButtons = dialog.getByRole('button', { name: 'Remove option' })

    await selectPerdOption(dialog.getByRole('combobox', { name: /^Type/u }), 'enum')
    await dialog.getByLabel('Option 1 name').fill('Down')
    await dialog.getByRole('button', { name: 'Add option' }).click()
    await dialog.getByLabel('Option 2 name').fill('Synthetic')
    await dialog.getByRole('button', { name: 'Add option' }).click()
    await dialog.getByLabel('Option 3 name').fill('Wool')
    await removeButtons.first().focus()
    await page.keyboard.press('Space')
    await expect(removeButtons).toHaveCount(2)
    await expect(dialog.getByLabel('Option 1 name')).toHaveValue('Synthetic')
    await expect(dialog.getByLabel('Option 1 name')).toBeFocused()
    await removeButtons.last().focus()
    await page.keyboard.press('Enter')
    await expect(removeButtons).toHaveCount(1)
    await expect(removeButtons).toBeDisabled()
    await expect(dialog.getByLabel('Option 1 name')).toHaveValue('Synthetic')
    await expect(dialog.getByLabel('Option 1 name')).toBeFocused()
    expect(store.writes).toHaveLength(0)
  })

  test('records the raw client failure and preserves safe characteristic form feedback', async ({ context, page, expectConsoleError }) => {
    const store = await mockStore(context)

    await signIn(context, page)
    await page.getByRole('button', { name: 'Add characteristic' }).click()

    const dialog = page.getByRole('dialog', { name: 'Add characteristic' })

    await dialog.getByLabel('Name', { exact: true }).fill('Packed length')

    await page.route((url) => url.pathname === apiPath, async (route) => {
      await route.abort('failed')
    })

    const errorPromise = expectConsoleError(/^Failed to save characteristic:/u)

    await dialog.getByRole('button', { name: 'Create characteristic' }).click()

    const diagnostic = await errorPromise
    const diagnosticArguments = diagnostic.args()
    const errorArguments = diagnosticArguments.slice(1)
    const rawErrorArgument = requireFirst(errorArguments)

    const rawError = await rawErrorArgument.evaluate((error: unknown) => {
      const isError = error instanceof Error
      const description = Error.prototype.toString.call(error)

      return {
        isError,
        description
      }
    })

    expect(rawError.isError).toBe(true)
    expect(rawError.description).toMatch(/^FetchError:/u)
    expect(rawError.description).toContain(apiPath)
    await expect(dialog.getByRole('alert')).toHaveText('Could not save the characteristic. Your input is still here. Try again.')
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Packed length')
    await expect(dialog.getByRole('button', { name: 'Create characteristic' })).toBeEnabled()
    expect(store.writes).toHaveLength(0)
  })

  test('preserves corrected input after validation and request errors, and blocks repeated writes', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Add characteristic' })

    await dialog.getByLabel('Name', { exact: true }).fill('New weight')
    await dialog.getByLabel('Slug', { exact: true }).fill('WRONG')
    await dialog.getByRole('button', { name: 'Create characteristic' }).click()
    await expect(dialog.getByLabel('Slug', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await dialog.getByLabel('Name', { exact: true }).fill('Another weight')
    await expect(dialog.getByLabel('Slug', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await dialog.getByLabel('Slug', { exact: true }).fill('another-weight')

    store.failNext = true

    await dialog.getByRole('button', { name: 'Create characteristic' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Your input is still here.')
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Another weight')

    const gate = createDeferred()

    store.gate = gate.promise

    await dialog.getByRole('button', { name: 'Create characteristic' }).click()
    await expect(dialog.getByRole('button', { name: 'Create characteristic' })).toBeDisabled()
    await expect.poll(() => store.writes.length).toBe(2)
    gate.resolve()
    await expect(dialog).not.toBeVisible()
    expect(store.writes).toHaveLength(2)
  })

  test('shows a stable drop target and preview, cancels a drag, and supports keyboard ordering', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    const order = await openOrder(page)
    const drag = row(order, 'Fill type').getByRole('button', { name: 'Drag Fill type to reorder' })

    const save = order.getByRole('button', {
      name: 'Save order',
      exact: true
    })

    await drag.click({ trial: true })
    await expect(save).toBeDisabled()

    const firstRectangle = await row(order, 'Temperature rating').boundingBox()
    const handleRectangle = await drag.boundingBox()
    const footerBeforeRectangle = await save.boundingBox()
    const first = requireBounds(firstRectangle)
    const handle = requireBounds(handleRectangle)
    const footerBefore = requireBounds(footerBeforeRectangle)

    await page.mouse.move(handle.x + 10, handle.y + 10)
    await page.mouse.down()
    await page.mouse.move(first.x + 60, first.y + 4, { steps: 5 })
    await expect(order.getByTestId('order-drag-preview')).toContainText('Fill type')
    await expect(order.getByTestId('order-drop-indicator')).toBeVisible()
    await expect(row(order, 'Fill type')).toHaveCSS('opacity', '0.4')
    await expect(order.getByRole('heading', { level: 3 })).toHaveText(['Temperature rating', 'Fill type'])

    const firstDuringRectangle = await row(order, 'Temperature rating').boundingBox()
    const footerDuringRectangle = await save.boundingBox()
    const indicatorRectangle = await order.getByTestId('order-drop-indicator').boundingBox()
    const firstDuring = requireBounds(firstDuringRectangle)
    const footerDuring = requireBounds(footerDuringRectangle)
    const indicator = requireBounds(indicatorRectangle)

    expect(firstDuring.y).toBeCloseTo(first.y, 0)
    expect(footerDuring.y).toBeCloseTo(footerBefore.y, 0)
    expect(indicator.y).toBeCloseTo(first.y, -1)
    expect(store.writes).toHaveLength(0)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(order).toBeVisible()
    await expect(order.getByTestId('order-drag-preview')).toHaveCount(0)
    await expect(order.getByRole('heading', { level: 3 })).toHaveText(['Temperature rating', 'Fill type'])
    await page.mouse.move(handle.x + 10, handle.y + 10)
    await page.mouse.down()
    await page.mouse.move(first.x + 60, first.y + 4, { steps: 5 })
    await page.mouse.up()
    await expect(order.getByRole('heading', { level: 3 })).toHaveText(['Fill type', 'Temperature rating'])
    await expect(row(order, 'Fill type')).toBeFocused()

    const moveDown = row(order, 'Fill type').getByRole('button', { name: 'Move Fill type down' })

    await moveDown.focus()
    await page.keyboard.press('Enter')
    await expect(save).toBeDisabled()
    await row(order, 'Fill type').getByRole('button', { name: 'Move Fill type up' }).click()
    await save.click()
    await expect(order).not.toBeVisible()

    const savedOrder = store.snapshot.properties.map((property) => property.id)

    expect(savedOrder).toEqual([12, 11])
  })

  test('keeps the dropped row visible after scrolling a long order', async ({ context, page }) => {
    const store = await mockStore(context)

    for (let index = 3; index <= 30; index += 1) {
      store.snapshot.properties.push({
        id: index + 100,
        name: `Characteristic ${index}`,
        slug: `characteristic-${index}`,
        dataType: 'text',
        unit: null,
        allowsNegativeValues: false,
        displayOrder: index - 1,
        usedItemCount: 0,
        negativeValueCount: 0,
        enumOptions: []
      })
    }

    await signIn(context, page)

    const order = await openOrder(page)
    const list = order.getByRole('list', { name: 'Characteristic order' })
    const drag = order.getByRole('button', { name: 'Drag Temperature rating to reorder' })

    await drag.click({ trial: true })

    const sourceRectangle = await drag.boundingBox()
    const destinationRectangle = await list.boundingBox()
    const source = requireBounds(sourceRectangle)
    const destination = requireBounds(destinationRectangle)

    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
    await page.mouse.down()
    await page.mouse.move(destination.x + 60, destination.y + destination.height - 4, { steps: 10 })
    await expect.poll(async () => list.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop), { timeout: 10_000 }).toBeLessThanOrEqual(1)
    await page.mouse.up()
    await expect(order.getByRole('heading', { level: 3 }).last()).toHaveText('Temperature rating')
    await expect(row(order, 'Temperature rating')).toBeInViewport({ ratio: 1 })
  })

  test('preserves an order draft when browser navigation is cancelled', async ({ context, page }) => {
    await mockStore(context)
    await signIn(context, page)

    await page.getByRole('link', {
      name: 'Back to categories',
      exact: true
    }).click()

    await page.getByRole('button', {
      name: 'Actions for Sleeping Bags',
      exact: true
    }).click()

    await page.getByRole('menuitem', {
      name: 'Characteristics',
      exact: true
    }).click()

    const order = await openOrder(page)

    await row(order, 'Fill type').getByRole('button', { name: 'Move Fill type up' }).click()
    await page.goBack()

    const confirmation = page.getByRole('dialog', { name: 'Discard order changes' })

    await confirmation.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(confirmation).not.toBeVisible()
    await expect(order.getByRole('heading', { level: 3 })).toHaveText(['Fill type', 'Temperature rating'])

    await order.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Fill type'])
  })

  test('shows reload only after a conflict, keeps rows on a failed recovery, and fits long names on a narrow screen', async ({ context, page }) => {
    const store = await mockStore(context)
    const property = requireFirst(store.snapshot.properties)

    property.name = 'Temperature rating for long expedition sleeping bags with winter insulation'

    await page.setViewportSize({
      width: 320,
      height: 800
    })

    await signIn(context, page)
    await expect(row(page, property.name)).toBeVisible()
    await expect(page).toHaveTitle('Sleeping Bags characteristics')

    await expect(page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })).toHaveCount(0)

    await row(page, property.name).getByRole('button', {
      name: `Edit ${property.name}`,
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit characteristic' })

    await dialog.getByLabel('Name', { exact: true }).click({ trial: true })

    const dialogRectangle = await dialog.boundingBox()
    const dialogBounds = requireBounds(dialogRectangle)
    const footerButtons = await dialog.getByRole('button', { name: /^(?:Cancel|Save characteristic)$/u }).all()
    const footerRectanglePromises = footerButtons.map(async (button) => button.boundingBox())
    const footerRectangles = await Promise.all(footerRectanglePromises)

    for (const rectangle of footerRectangles) {
      const bounds = requireBounds(rectangle)

      expect(bounds.x).toBeGreaterThanOrEqual(dialogBounds.x)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(dialogBounds.x + dialogBounds.width)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(800)
    }

    await dialog.getByLabel('Name', { exact: true }).fill('Updated temperature')

    store.snapshot.category.propertiesRevision += 1

    await dialog.getByRole('button', {
      name: 'Save characteristic',
      exact: true
    }).click()

    await expect(dialog.getByRole('alert')).toContainText('Your input is still here.')
    await expect(dialog.getByLabel('Name', { exact: true })).toHaveValue('Updated temperature')

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(dialog).not.toBeVisible()

    store.failRead = true

    await page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    }).click()

    await expect(page.getByRole('alert')).toContainText('Could not load characteristics.')

    await expect(page.getByRole('button', {
      name: 'Retry',
      exact: true
    })).toBeFocused()

    await expect(page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })).toHaveCount(0)

    const characteristic = row(page, property.name)

    await expect(characteristic).toBeVisible()

    const actions = characteristic.getByRole('button')
    const buttons = await actions.all()
    const rectanglePromises = buttons.map(async (button) => button.boundingBox())
    const rectangles = await Promise.all(rectanglePromises)

    for (const rectangle of rectangles) {
      const bounds = requireBounds(rectangle)

      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320)
    }

    store.failRead = false

    await page.getByRole('button', {
      name: 'Retry',
      exact: true
    }).click()

    await expect(page.getByRole('alert')).toHaveCount(0)

    await expect(page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    })).toBeFocused()

    await expect(page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })).toHaveCount(0)
  })

  test('uses the stable category ID link', async ({ context, page }) => {
    await mockStore(context)
    await signIn(context, page)

    await page.getByRole('link', {
      name: 'Back to categories',
      exact: true
    }).click()

    await page.getByRole('button', {
      name: 'Actions for Sleeping Bags',
      exact: true
    }).click()

    const link = page.getByRole('menuitem', {
      name: 'Characteristics',
      exact: true
    })

    await expect(link).toHaveAttribute('href', pagePath)
    await link.click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sleeping Bags characteristics')
  })
})

test.describe('characteristics touch input', () => {
  test.use({
    hasTouch: true,

    viewport: {
      width: 390,
      height: 844
    }
  })

  test('reorders from a touch drag handle', async ({ context, page }) => {
    await mockStore(context)
    await signIn(context, page)

    const order = await openOrder(page)
    const handle = row(order, 'Fill type').getByRole('button', { name: 'Drag Fill type to reorder' })

    await handle.click({ trial: true })

    const sourceRectangle = await handle.boundingBox()
    const destinationRectangle = await row(order, 'Temperature rating').boundingBox()
    const source = requireBounds(sourceRectangle)
    const destination = requireBounds(destinationRectangle)
    const session = await context.newCDPSession(page)

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',

      touchPoints: [{
        // oxlint-disable-next-line id-length -- CDP uses the wire field x.
        x: source.x + source.width / 2,

        // oxlint-disable-next-line id-length -- CDP uses the wire field y.
        y: source.y + source.height / 2
      }]
    })

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',

      touchPoints: [{
        // oxlint-disable-next-line id-length -- CDP uses the wire field x.
        x: destination.x + 50,

        // oxlint-disable-next-line id-length -- CDP uses the wire field y.
        y: destination.y + 20
      }]
    })

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })

    await expect(order.getByRole('heading', { level: 3 })).toHaveText(['Fill type', 'Temperature rating'])
    await expect(row(order, 'Fill type')).toBeFocused()

    await page.getByRole('button', {
      name: 'Save order',
      exact: true
    }).click()

    await page.reload()
    await signIn(context, page)
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Fill type', 'Temperature rating'])
  })
})

test('rejects a non-admin before requesting characteristics', async ({ context, page }) => {
  const requests: Request[] = []

  page.on('request', (request) => {
    // oxlint-disable-next-line vitest/no-conditional-in-test -- The listener records only protected characteristic requests.
    if (request.url().includes(apiPath)) { requests.push(request) }
  })

  await signIn(context, page, false)

  const pagePattern = `${pagePath}$`
  const pageExpression = new RegExp(pagePattern, 'u')

  await expect(page).not.toHaveURL(pageExpression)
  expect(requests).toHaveLength(0)
})
