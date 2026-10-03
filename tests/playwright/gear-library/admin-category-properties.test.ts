import type { BrowserContext, Page, Request } from '@playwright/test'
import * as v from 'valibot'
import type { AdminCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'

import {
  categoryPropertiesOrderSchema,
  categoryPropertyDeleteSchema,
  categoryPropertyMutationSchema,
  categoryPropertyUpdateSchema,
  propertiesRevisionBodySchema,
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
  gate: Promise<void> | null;
}

async function mockStore(context: BrowserContext): Promise<Store> {
  const store: Store = {
    snapshot: globalThis.structuredClone(initialSnapshot),
    writes: [],
    failNext: false,
    changeDeleteCount: false,
    failRead: false,
    gate: null
  }

  let nextId = 30

  // oxlint-disable-next-line complexity -- The stateful HTTP mock dispatches the characteristic and option methods.
  await context.route((url) => url.pathname.startsWith(apiPath), async (route) => {
    const request = route.request()
    const url = new globalThis.URL(request.url())
    const method = request.method()

    if (method === 'GET') {
      await route.fulfill(store.failRead ? {
        status: 503,
        json: { statusCode: 503 }
      } : { json: store.snapshot })

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

    const raw: unknown = request.postDataJSON()
    const revision = v.parse(propertiesRevisionBodySchema, raw)

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
    const parts = suffix.split('/').filter(Boolean)
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
      const body = v.parse(categoryPropertyDeleteSchema, raw)

      if (store.changeDeleteCount) {
        store.changeDeleteCount = false
        property.usedItemCount += 1
      }

      if (body.expectedAffectedItemCount !== property.usedItemCount) {
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
function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', {
    name,
    exact: true
  }) })
}

test.describe('admin category characteristics', () => {
  test('keeps an order draft after a conflict and requires cancel before reloading', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await expect(page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })).toHaveCount(0)

    await row(page, 'Fill type').getByRole('button', {
      name: 'Move Fill type up',
      exact: true
    }).click()

    store.snapshot.category.propertiesRevision += 1

    await page.getByRole('button', {
      name: 'Save order',
      exact: true
    }).click()

    await expect(page.getByRole('alert')).toContainText('Your draft is still here.')
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Fill type', 'Temperature rating'])

    const reload = page.getByRole('button', {
      name: 'Reload characteristics',
      exact: true
    })

    await expect(reload).toBeDisabled()

    await page.getByRole('main').getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(reload).toBeEnabled()
    await reload.click()
    await expect(reload).toHaveCount(0)

    await expect(page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    })).toBeFocused()

    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Fill type'])

    await expect(page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    })).toBeEnabled()
  })

  test('creates characteristics and enum options, edits stable IDs, cancels and saves order, and survives reload', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Add characteristic' })

    await dialog.getByLabel('Name', { exact: true }).fill('Insulation type')
    await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue('insulation-type')
    await selectPerdOption(dialog.getByRole('combobox', { name: /^Type/u }), 'enum')
    await dialog.getByLabel('Option 1 name').fill('Down')
    await expect(dialog.getByLabel('Option 1 slug')).toHaveValue('down')
    await dialog.getByRole('button', { name: 'Create characteristic' }).click()

    const characteristic = row(page, 'Insulation type')

    await characteristic.getByText('Options (1)', { exact: true }).click()
    await expect(characteristic.getByText('Keep at least one option.')).toBeVisible()

    await characteristic.getByRole('button', {
      name: 'Add option',
      exact: true
    }).click()

    const optionDialog = page.getByRole('dialog', { name: 'Add option' })

    await optionDialog.getByLabel('Name', { exact: true }).fill('Synthetic')
    await optionDialog.getByRole('button', { name: 'Create option' }).click()

    await characteristic.getByRole('button', {
      name: 'Edit option Down',
      exact: true
    }).click()

    const editing = page.getByRole('dialog', { name: 'Edit option' })

    await editing.getByLabel('Name', { exact: true }).fill('Duck down')
    await expect(editing.getByLabel('Slug', { exact: true })).toHaveValue('down')
    await editing.getByLabel('Slug', { exact: true }).fill('duck-down')
    await editing.getByRole('button', { name: 'Save option' }).click()
    await expect(characteristic.getByText('Duck down', { exact: true })).toBeVisible()

    await characteristic.getByRole('button', {
      name: 'Delete option Synthetic',
      exact: true
    }).click()

    await page.getByRole('dialog', { name: 'Delete option' }).getByRole('button', {
      name: 'Delete option',
      exact: true
    }).click()

    await expect(characteristic.getByRole('button', {
      name: 'Delete option Synthetic',
      exact: true
    })).toHaveCount(0)

    await expect(characteristic.getByText('Keep at least one option.')).toBeVisible()
    await characteristic.getByRole('button', { name: 'Move Insulation type up' }).click()
    await expect(characteristic).toBeFocused()

    await expect(page.getByRole('button', {
      name: 'Add characteristic',
      exact: true
    })).toBeDisabled()

    await page.getByRole('main').getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Fill type', 'Insulation type'])
    await expect(characteristic).toBeFocused()
    await characteristic.getByRole('button', { name: 'Move Insulation type up' }).click()

    await page.getByRole('button', {
      name: 'Save order',
      exact: true
    }).click()

    await expect(page.getByRole('button', {
      name: 'Save order',
      exact: true
    })).toHaveCount(0)

    await expect(characteristic).toBeFocused()
    await page.reload()
    await signIn(context, page)
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Temperature rating', 'Insulation type', 'Fill type'])
    expect(store.snapshot.category.propertiesRevision).toBe(5)
  })

  test('explains used fields and keeps names editable without changing slugs', async ({ context, page }) => {
    await mockStore(context)
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

    const fill = row(page, 'Fill type')

    await fill.getByText('Options (2)', { exact: true }).click()

    await expect(fill.getByRole('button', {
      name: 'Delete option Down',
      exact: true
    })).toBeDisabled()

    await fill.getByRole('button', {
      name: 'Edit option Down',
      exact: true
    }).click()

    await expect(page.getByRole('dialog').getByText('3 items use this option. Changing its slug also updates their saved choice.')).toBeVisible()
  })

  test('refreshes deletion counts and requires a second explicit confirmation', async ({ context, page }) => {
    const store = await mockStore(context)

    await signIn(context, page)

    await row(page, 'Fill type').getByRole('button', {
      name: 'Delete Fill type',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Delete characteristic' })

    await expect(dialog).toContainText('3 items and deletes 2 enum options')

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    expect(store.writes).toHaveLength(0)

    await row(page, 'Fill type').getByRole('button', {
      name: 'Delete Fill type',
      exact: true
    }).click()

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

  test('supports pointer dragging, keyboard ordering, and confirmation before discarding a draft', async ({ context, page }) => {
    await mockStore(context)
    await signIn(context, page)

    const drag = row(page, 'Fill type').getByRole('button', { name: 'Drag Fill type to reorder' })

    await drag.click({ trial: true })

    const first = await row(page, 'Temperature rating').boundingBox()
    const handle = await drag.boundingBox()
    const firstBounds = requireBounds(first)
    const handleBounds = requireBounds(handle)

    await page.mouse.move(handleBounds.x + 5, handleBounds.y + 5)
    await page.mouse.down()
    await page.mouse.move(firstBounds.x + 50, firstBounds.y + 20, { steps: 5 })
    await page.mouse.up()
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Fill type', 'Temperature rating'])
    await expect(row(page, 'Fill type')).toBeFocused()

    await page.getByRole('link', {
      name: 'Back to categories',
      exact: true
    }).click()

    const confirmation = page.getByRole('dialog', { name: 'Discard order changes' })

    await confirmation.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(confirmation).not.toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${pagePath}$`, 'u'))

    await expect(page.getByRole('link', {
      name: 'Back to categories',
      exact: true
    })).toBeFocused()

    const moveDown = row(page, 'Fill type').getByRole('button', { name: 'Move Fill type down' })

    await moveDown.focus()
    await expect(moveDown).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('button', {
      name: 'Save order',
      exact: true
    })).toHaveCount(0)
  })

  test('shows reload only after a conflict, keeps rows on a failed recovery, and fits long names on a narrow screen', async ({ context, page }) => {
    const store = await mockStore(context)
    const property = requireFirst(store.snapshot.properties)

    property.name = 'Temperature rating for long expedition sleeping bags with winter insulation'

    await page.setViewportSize({
      width: 360,
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
    const rectangles = await Promise.all(buttons.map(async (button) => button.boundingBox()))

    for (const rectangle of rectangles) {
      const bounds = requireBounds(rectangle)

      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(360)
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

    const handle = row(page, 'Fill type').getByRole('button', { name: 'Drag Fill type to reorder' })

    await handle.click({ trial: true })

    const sourceRectangle = await handle.boundingBox()
    const destinationRectangle = await row(page, 'Temperature rating').boundingBox()
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

    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(['Fill type', 'Temperature rating'])
    await expect(row(page, 'Fill type')).toBeFocused()

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
  await expect(page).not.toHaveURL(new RegExp(`${pagePath}$`, 'u'))
  expect(requests).toHaveLength(0)
})
