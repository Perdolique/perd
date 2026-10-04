import type { BrowserContext, Locator, Page, Request } from '@playwright/test'
import * as v from 'valibot'
import type { CategoryDetailResponse } from '../../../server/api/equipment/categories/by-slug/[slug].get'
import type { EquipmentItemEditResponse } from '../../../server/utils/equipment/item-edit-snapshot'
import { expect, test } from '../fixtures/global.fixtures.ts'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { mockTwitchSignIn } from '../fixtures/twitch-auth.fixtures.ts'
import { createDeferred, mockCatalogApi, selectPerdOption } from '../fixtures/gear-library-entry-list.fixtures.ts'

const itemId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const userId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
const itemPath = `/gear-library/${itemId}`
const editorPath = `/admin/equipment/items/${itemId}/edit`
const apiPath = `/api/equipment/items/${itemId}`

const brand = {
  id: 1,
  name: 'Brand',
  slug: 'brand'
}

const originalCategory: CategoryDetailResponse = {
  id: 1,
  name: 'Old category',
  slug: 'old',
  propertiesRevision: 0,

  properties: [{
    id: 1,
    name: 'Weight',
    slug: 'weight',
    dataType: 'number',
    unit: 'g',
    allowsNegativeValues: false
  }, {
    id: 2,
    name: 'Waterproof',
    slug: 'waterproof',
    dataType: 'boolean',
    unit: null,
    allowsNegativeValues: false
  }, {
    id: 3,
    name: 'Notes',
    slug: 'notes',
    dataType: 'text',
    unit: null,
    allowsNegativeValues: false
  }, {
    id: 4,
    name: 'Fill',
    slug: 'fill',
    dataType: 'enum',
    unit: null,
    allowsNegativeValues: false,

    enumOptions: [{
      id: 1,
      name: 'Down',
      slug: 'down'
    }]
  }]
}

const targetCategory: CategoryDetailResponse = {
  id: 2,
  name: 'New category',
  slug: 'new',
  propertiesRevision: 3,

  properties: [{
    id: 11,
    name: 'Weight',
    slug: 'weight',
    dataType: 'number',
    unit: 'g',
    allowsNegativeValues: false
  }, {
    id: 12,
    name: 'Waterproof',
    slug: 'waterproof',
    dataType: 'boolean',
    unit: null,
    allowsNegativeValues: false
  }, {
    id: 13,
    name: 'Description',
    slug: 'description',
    dataType: 'text',
    unit: null,
    allowsNegativeValues: false
  }]
}

const longWeightName = 'W'.repeat(64)

const longNameProperties = originalCategory.properties.map((property) => {
  if (property.id !== 1) { return property }

  return {
    ...property,
    name: longWeightName
  }
})

const categoryWithLongWeightName: CategoryDetailResponse = {
  ...originalCategory,
  properties: longNameProperties
}

const inputSchema = v.object({
  name: v.string(),
  brandId: v.number(),
  categoryId: v.number(),

  properties: v.array(v.object({
    propertyId: v.number(),
    value: v.union([v.boolean(), v.string()])
  })),

  expectedItemRevision: v.number(),
  expectedPropertiesRevision: v.number(),
  expectedOriginalPropertiesRevision: v.number(),
  categoryChangeConfirmed: v.boolean()
})

interface EditorMockState {
  snapshot: EquipmentItemEditResponse;
  requests: unknown[];
  saveStatus: number;
  readStatus: number;
  categoryStatus: number;
  referencesStatus: number;
  detailStatus: number;
  saveGate?: Promise<void>;
  categoryGate?: Promise<void>;
}

function detailResponse(snapshot: EquipmentItemEditResponse) {
  const properties = snapshot.properties.map((entry) => {
    const property = snapshot.category.properties.find((candidate) => candidate.id === entry.propertyId)

    if (!property) { throw new Error('Missing test property') }

    const value = property.dataType === 'number' ? Number(entry.value) : entry.value

    return {
      name: property.name,
      slug: property.slug,
      dataType: property.dataType,
      unit: property.unit,
      value
    }
  })

  return {
    id: snapshot.id,
    name: snapshot.name,
    brand: snapshot.brand,

    category: {
      id: snapshot.category.id,
      name: snapshot.category.name,
      slug: snapshot.category.slug
    },

    properties,
    isInMyGear: true,
    cloudflareImageId: null,
    createdAt: '2026-10-01T00:00:00.000Z'
  }
}

async function mockEditor(context: BrowserContext): Promise<EditorMockState> {
  const state: EditorMockState = {
    snapshot: {
      id: itemId,
      name: 'Original item',
      brand,
      category: originalCategory,
      revision: 0,

      properties: [{
        propertyId: 1,
        value: '9007199254740993.125'
      }, {
        propertyId: 2,
        value: false
      }, {
        propertyId: 3,
        value: 'Keep me'
      }, {
        propertyId: 4,
        value: 'down'
      }]
    },

    requests: [],
    saveStatus: 200,
    readStatus: 200,
    categoryStatus: 200,
    referencesStatus: 200,
    detailStatus: 200
  }

  await mockCatalogApi(context, {
    brands: () => {
      const json = state.referencesStatus === 200 ? [brand] : { statusCode: state.referencesStatus }

      return {
        status: state.referencesStatus,
        json
      }
    },

    categories: () => {
      const json = state.referencesStatus === 200 ? [originalCategory, targetCategory] : { statusCode: state.referencesStatus }

      return {
        status: state.referencesStatus,
        json
      }
    },

    items: () => {
      const item = detailResponse(state.snapshot)

      return {
        json: {
          items: [item],
          total: 1,
          page: 1,
          limit: 20
        }
      }
    },

    categoryDetail: async ({ url }) => {
      await state.categoryGate

      const category = url.pathname.endsWith('/new') ? targetCategory : originalCategory

      return {
        status: state.categoryStatus,

        json: state.categoryStatus === 200 ? category : {
          statusCode: state.categoryStatus,
          message: 'Failed to load category'
        }
      }
    },

    itemDetails: () => {
      const json = state.detailStatus === 200 ? detailResponse(state.snapshot) : { statusCode: state.detailStatus }

      return {
        status: state.detailStatus,
        json
      }
    }
  })

  await context.route((url) => url.pathname === `${apiPath}/edit`, async (route) => {
    await route.fulfill({
      status: state.readStatus,

      json: state.readStatus === 200 ? state.snapshot : {
        statusCode: state.readStatus,
        message: 'Failed to read item'
      }
    })
  })

  await context.route((url) => url.pathname === apiPath, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback()

      return
    }

    const input: unknown = route.request().postDataJSON()

    state.requests.push(input)

    await state.saveGate

    if (state.saveStatus !== 200) {
      await route.fulfill({
        status: state.saveStatus,

        json: {
          statusCode: state.saveStatus,
          message: 'Item changed',
          data: { code: 'item_revision_conflict' }
        }
      })

      return
    }

    const body = v.parse(inputSchema, input)

    state.snapshot = {
      id: itemId,
      name: body.name,
      brand,
      revision: state.snapshot.revision + 1,
      category: body.categoryId === originalCategory.id ? originalCategory : targetCategory,
      properties: body.properties
    }

    await route.fulfill({ json: state.snapshot })
  })

  return state
}

interface SignInOptions {
  target?: string;
  isAdmin?: boolean;
}

async function signIn(context: BrowserContext, page: Page, { target = editorPath, isAdmin = true }: SignInOptions = {}) {
  await mockAccountUser(context, {
    email: null,
    isAdmin,
    isGuest: false,
    isTwitchLinked: true,
    userId
  })

  await mockTwitchSignIn(context, page, {
    redirectTo: target,

    user: {
      email: null,
      isAdmin,
      isGuest: false,
      userId
    }
  })
}

function categorySelect(page: Page) { return page.getByRole('combobox', { name: /^Category/u }) }

function isTargetRequest(request: Request) { return request.url().endsWith('/api/equipment/categories/by-slug/new') }

async function expectMappingLayout(dialog: Locator, contents: Locator[]) {
  const geometry = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const root = globalThis.document.documentElement

    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      viewportWidth: root.clientWidth,
      viewportHeight: root.clientHeight,
      documentWidth: root.scrollWidth,
      width: element.clientWidth,
      contentWidth: element.scrollWidth
    }
  })

  expect(geometry.left).toBeGreaterThanOrEqual(0)
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(geometry.top).toBeGreaterThanOrEqual(0)
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.width)

  /* oxlint-disable no-await-in-loop -- Each measurement needs its own completed scroll position. */
  for (const content of contents) {
    await expect(content).toBeVisible()
    await content.scrollIntoViewIfNeeded()
    await expect(content).toBeInViewport({ ratio: 1 })

    const bounds = await content.evaluate((element) => {
      const rectangle = element.getBoundingClientRect()

      return {
        left: rectangle.left,
        right: rectangle.right,
        width: element.clientWidth,
        contentWidth: element.scrollWidth,
        height: element.clientHeight,
        contentHeight: element.scrollHeight
      }
    })

    expect(bounds.left).toBeGreaterThanOrEqual(geometry.left)
    expect(bounds.right).toBeLessThanOrEqual(geometry.right)
    expect(bounds.contentWidth).toBeLessThanOrEqual(bounds.width)
    expect(bounds.contentHeight).toBeLessThanOrEqual(bounds.height)
  }
  /* oxlint-enable no-await-in-loop */
}

test.describe('Published item editing', () => {
  test('opens from the item, saves once, returns with notice, and invalidates catalog rows', async ({ context, page }) => {
    const state = await mockEditor(context)

    await test.step('Open the editor from the catalog item menu', async () => {
      await signIn(context, page, { target: '/gear-library?q=Original' })

      await page.getByRole('link', {
        name: 'Original item',
        exact: true
      }).click()

      await page.getByRole('button', {
        name: 'More',
        exact: true
      }).click()

      const editAction = page.getByRole('menuitem', {
        name: 'Edit item',
        exact: true
      })

      await expect(page.getByRole('menu', {
        name: 'Item actions',
        exact: true
      })).toBeVisible()

      await expect(editAction.locator('.iconify')).toHaveCSS('mask-image', /url\(/u)
      await page.screenshot({ path: test.info().outputPath('item-actions-menu.png') })
      await editAction.click()

      await expect(page.getByRole('heading', {
        name: 'Edit item',
        exact: true
      })).toBeVisible()

      await expect(page.getByRole('button', {
        name: 'Save changes',
        exact: true
      })).toBeDisabled()
    })

    await test.step('Save once and show the updated item', async () => {
      await page.getByLabel('Item name', { exact: true }).fill('Corrected item')

      const saveGate = createDeferred()

      state.saveGate = saveGate.promise

      await page.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect.poll(() => state.requests.length).toBe(1)

      await expect(page.getByRole('button', {
        name: 'Save changes',
        exact: true
      })).toBeDisabled()

      saveGate.resolve()
      await expect(page).toHaveURL(`${itemPath}?q=Original`)
      await expect(page.getByRole('heading', { name: 'Corrected item' })).toBeVisible()
      await expect(page.getByRole('status').filter({ hasText: 'Changes saved.' })).toBeVisible()
      expect(state.requests).toHaveLength(1)

      expect(state.requests[0]).toMatchObject({
        expectedItemRevision: 0,
        expectedPropertiesRevision: 0,
        expectedOriginalPropertiesRevision: 0,
        categoryChangeConfirmed: false,

        properties: [{
          propertyId: 1,
          value: '9007199254740993.125'
        }, {
          propertyId: 2,
          value: false
        }, {
          propertyId: 3,
          value: 'Keep me'
        }, {
          propertyId: 4,
          value: 'down'
        }]
      })
    })

    await test.step('Refresh catalog rows and consume the saved notice', async () => {
      await page.getByRole('link', {
        name: 'Back to gear library',
        exact: true
      }).click()

      await expect(page.getByRole('link', {
        name: 'Corrected item',
        exact: true
      })).toBeVisible()

      await page.getByRole('link', {
        name: 'Corrected item',
        exact: true
      }).click()

      await expect(page.getByText('Changes saved.', { exact: true })).toHaveCount(0)
    })
  })

  test('maps the current draft with explicit losses on a narrow screen and saves target IDs', async ({ context, page }) => {
    await page.setViewportSize({
      width: 320,
      height: 844
    })

    const state = await mockEditor(context)
    const weightDraft = '9007199254740995.375'
    const repeatedNote = 'Long unbroken note '.repeat(15)
    const unbrokenNote = 'x'.repeat(100)
    const notesDraft = `Edited before mapping: ${repeatedNote}${unbrokenNote}`

    state.snapshot.category = categoryWithLongWeightName

    const dialog = page.getByRole('dialog', {
      name: 'Change category',
      exact: true
    })

    await test.step('Edit current values and open category mapping', async () => {
      await signIn(context, page)
      await page.getByLabel(longWeightName, { exact: true }).fill(weightDraft)
      await page.getByLabel('Notes', { exact: true }).fill(notesDraft)
      await selectPerdOption(categorySelect(page), 'new')
    })

    await test.step('Resolve compatible matches and explicitly discard the enum', async () => {
      await expect(dialog.getByRole('combobox', {
        name: /^Transfer W{64} to/u
      })).toHaveAttribute('data-value', '11')

      await expect(dialog.getByRole('combobox', {
        name: /^Transfer Waterproof to/u
      })).toHaveAttribute('data-value', '12')

      await expect(dialog.getByRole('button', {
        name: 'Apply mapping',
        exact: true
      })).toBeDisabled()

      const notesTarget = dialog.getByRole('combobox', { name: /^Transfer Notes to/u })

      await notesTarget.focus()
      await notesTarget.press('Enter')
      await notesTarget.press('ArrowDown')
      await notesTarget.press('ArrowDown')
      await notesTarget.press('Enter')
      await expect(notesTarget).toHaveAttribute('data-value', '13')

      await selectPerdOption(dialog.getByRole('combobox', {
        name: /^Transfer Fill to/u
      }), 'discard')

      await expect(dialog.getByText('Will not transfer: Down', { exact: true })).toBeVisible()

      await expect(dialog.getByRole('button', {
        name: 'Apply mapping',
        exact: true
      })).toBeEnabled()
    })

    await test.step('Keep previews and controls visible inside the narrow dialog', async () => {
      const weightPreviewText = `${longWeightName}: ${weightDraft} g`
      const notesPreviewText = `Notes: ${notesDraft}`
      const weightLabel = `Transfer ${longWeightName} to`
      const weightPreview = dialog.getByText(weightPreviewText, { exact: true })
      const notesPreview = dialog.getByText(notesPreviewText, { exact: true })
      const booleanPreview = dialog.getByText('Waterproof: No', { exact: true })
      const enumPreview = dialog.getByText('Fill: Down', { exact: true })
      const transferLabel = dialog.getByText(weightLabel, { exact: true })
      const controls = await dialog.getByRole('combobox').all()

      const applyButton = dialog.getByRole('button', {
        name: 'Apply mapping',
        exact: true
      })

      const contents = [weightPreview, notesPreview, booleanPreview, enumPreview, transferLabel, ...controls, applyButton]

      await expectMappingLayout(dialog, contents)
      await page.screenshot({ path: test.info().outputPath('mapping-mobile.png') })
    })

    await test.step('Apply the draft and cancel another category change', async () => {
      await dialog.getByRole('button', {
        name: 'Apply mapping',
        exact: true
      }).click()

      await expect(page.getByLabel('Description', { exact: true })).toHaveValue(notesDraft)
      await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('9007199254740995.375')

      await expect(page.getByRole('combobox', {
        name: /^Waterproof/u
      })).toHaveAttribute('data-value', 'false')

      expect(state.requests).toHaveLength(0)
      await selectPerdOption(categorySelect(page), 'old')

      await expect(dialog.getByRole('combobox', {
        name: /^Transfer Weight to/u
      })).toHaveAttribute('data-value', '1')

      await page.keyboard.press('Escape')
      await expect(categorySelect(page)).toHaveAttribute('data-value', 'new')
      await expect(categorySelect(page)).toBeFocused()
      await expect(page.getByLabel('Description', { exact: true })).toHaveValue(notesDraft)
    })

    await test.step('Save mapped target values and return to the item', async () => {
      await page.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect(page).toHaveURL(itemPath)

      expect(state.requests[0]).toMatchObject({
        categoryId: 2,
        categoryChangeConfirmed: true,
        expectedOriginalPropertiesRevision: 0,
        expectedPropertiesRevision: 3,

        properties: [{
          propertyId: 11,
          value: '9007199254740995.375'
        }, {
          propertyId: 12,
          value: false
        }, {
          propertyId: 13,
          value: notesDraft
        }]
      })

      const size = await page.evaluate(() => {
        return {
          viewport: globalThis.document.documentElement.clientWidth,
          content: globalThis.document.documentElement.scrollWidth
        }
      })

      expect(size.content).toBeLessThanOrEqual(size.viewport)
    })
  })

  test('keeps invalid edits dirty and cancels both mapping and page navigation safely', async ({ context, page }) => {
    const state = await mockEditor(context)

    await signIn(context, page)
    await selectPerdOption(categorySelect(page), 'new')

    await page.getByRole('dialog', { name: 'Change category' }).getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(categorySelect(page)).toHaveAttribute('data-value', 'old')
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Keep me')
    await page.getByLabel('Item name', { exact: true }).fill('')

    await expect(page.getByRole('button', {
      name: 'Save changes',
      exact: true
    })).toBeDisabled()

    await page.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    const discard = page.getByRole('dialog', {
      name: 'Discard changes',
      exact: true
    })

    await discard.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByLabel('Item name', { exact: true })).toHaveValue('')

    await page.getByRole('link', {
      name: 'Back to item',
      exact: true
    }).click()

    await discard.getByRole('button', {
      name: 'Discard',
      exact: true
    }).click()

    await expect(page).toHaveURL(itemPath)
    expect(state.requests).toHaveLength(0)
  })

  test('preserves the draft on failed save, conflict, and failed reload', async ({ context, page }) => {
    const state = await mockEditor(context)

    state.saveStatus = 500

    await test.step('Keep the draft after a failed save', async () => {
      await signIn(context, page)
      await page.getByLabel('Item name', { exact: true }).fill('My correction')

      await page.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect(page.getByRole('alert').filter({ hasText: 'Could not confirm' })).toBeVisible()
      await expect(page.getByLabel('Item name', { exact: true })).toHaveValue('My correction')
    })

    await test.step('Explain the conflict and block another save', async () => {
      state.saveStatus = 409

      await page.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      const conflict = page.getByRole('alert').filter({ hasText: 'This item or its reference data changed' })

      await expect(conflict).toBeFocused()

      await expect(page.getByRole('button', {
        name: 'Save changes',
        exact: true
      })).toBeDisabled()
    })

    await test.step('Keep the draft when reloading fails', async () => {
      state.readStatus = 500

      await page.getByRole('button', {
        name: 'Reload item',
        exact: true
      }).click()

      await page.getByRole('dialog', {
        name: 'Reload item',
        exact: true
      }).getByRole('button', {
        name: 'Reload',
        exact: true
      }).click()

      await expect(page.getByText('Could not reload the item. Your draft is still here. Try again.', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Item name', { exact: true })).toHaveValue('My correction')
    })

    await test.step('Reload the current snapshot and focus the new editor', async () => {
      state.readStatus = 200
      state.snapshot = {
        ...state.snapshot,
        name: 'Latest version',
        revision: 1
      }

      await page.getByRole('button', {
        name: 'Reload item',
        exact: true
      }).click()

      await page.getByRole('dialog', {
        name: 'Reload item',
        exact: true
      }).getByRole('button', {
        name: 'Reload',
        exact: true
      }).click()

      await expect(page.getByLabel('Item name', { exact: true })).toHaveValue('Latest version')
      await expect(page.getByLabel('Item name', { exact: true })).toBeFocused()
    })

    await test.step('Save against the reloaded revision', async () => {
      state.saveStatus = 200

      await page.getByLabel('Item name', { exact: true }).fill('Accepted correction')

      await page.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect(page).toHaveURL(itemPath)
      expect(state.requests.at(-1)).toMatchObject({ expectedItemRevision: 1 })
    })
  })

  test('cancels the category request at transport level when mapping is closed', async ({ context, page }) => {
    const state = await mockEditor(context)
    const gate = createDeferred()

    state.categoryGate = gate.promise

    await signIn(context, page)

    const started = page.waitForRequest(isTargetRequest)
    const cancelled = page.waitForEvent('requestfailed', isTargetRequest)

    await selectPerdOption(categorySelect(page), 'new')

    await started

    await page.getByRole('dialog', {
      name: 'Change category',
      exact: true
    }).getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await cancelled

    gate.resolve()
    await expect(categorySelect(page)).toHaveAttribute('data-value', 'old')
    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Keep me')
    expect(state.requests).toHaveLength(0)
  })

  test('keeps the source draft when category loading fails and supports retry', async ({ context, page }) => {
    const state = await mockEditor(context)

    state.categoryStatus = 500

    await signIn(context, page)
    await selectPerdOption(categorySelect(page), 'new')

    const dialog = page.getByRole('dialog', {
      name: 'Change category',
      exact: true
    })

    await expect(dialog.getByRole('alert')).toContainText('Your draft has not changed')

    await expect(dialog.getByRole('button', {
      name: 'Apply mapping',
      exact: true
    })).toBeDisabled()

    state.categoryStatus = 200

    await dialog.getByRole('button', {
      name: 'Retry',
      exact: true
    }).click()

    await expect(dialog.getByRole('combobox', {
      name: /^Transfer Weight to/u
    })).toHaveAttribute('data-value', '11')

    await dialog.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Keep me')
  })

  test('recovers reference lists without losing edits and retries reading after a successful save', async ({ context, page }) => {
    const state = await mockEditor(context)

    state.referencesStatus = 500

    await signIn(context, page)
    await page.getByLabel('Item name', { exact: true }).fill('Draft with missing references')

    await expect(page.getByRole('button', {
      name: 'Save changes',
      exact: true
    })).toBeDisabled()

    state.referencesStatus = 200

    await page.getByRole('button', {
      name: 'Retry',
      exact: true
    }).click()

    await expect(page.getByLabel('Item name', { exact: true })).toHaveValue('Draft with missing references')
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('9007199254740993.125')

    state.detailStatus = 500

    await page.getByRole('button', {
      name: 'Save changes',
      exact: true
    }).click()

    await expect(page).toHaveURL(itemPath)
    await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible()

    await expect(page.getByRole('button', {
      name: 'Save changes',
      exact: true
    })).toHaveCount(0)

    state.detailStatus = 200

    await page.getByRole('button', {
      name: 'Retry',
      exact: true
    }).click()

    await expect(page.getByRole('heading', {
      name: 'Draft with missing references',
      exact: true
    })).toBeVisible()

    expect(state.requests).toHaveLength(1)
  })

  test('requires discarding an invalid numeric draft and does not resurrect values on a later category change', async ({ context, page }) => {
    const state = await mockEditor(context)

    state.snapshot = {
      ...state.snapshot,
      properties: []
    }

    await signIn(context, page)
    await page.getByLabel('Weight', { exact: true }).fill('-')

    await expect(page.getByRole('button', {
      name: 'Save changes',
      exact: true
    })).toBeDisabled()

    await page.getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await page.getByRole('dialog', {
      name: 'Discard changes',
      exact: true
    }).getByRole('button', {
      name: 'Cancel',
      exact: true
    }).click()

    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('-')
    await selectPerdOption(categorySelect(page), 'new')

    const dialog = page.getByRole('dialog', {
      name: 'Change category',
      exact: true
    })

    await expect(dialog.getByText('No compatible field.', { exact: false })).toBeVisible()

    await expect(dialog.getByRole('button', {
      name: 'Apply mapping',
      exact: true
    })).toBeDisabled()

    await selectPerdOption(dialog.getByRole('combobox', { name: /^Transfer Weight to/u }), 'discard')

    await dialog.getByRole('button', {
      name: 'Apply mapping',
      exact: true
    }).click()

    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('')

    // With no remaining values, a later change only needs the category definitions.
    await selectPerdOption(categorySelect(page), 'old')
    await expect(categorySelect(page)).toHaveAttribute('data-value', 'old')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByLabel('Weight', { exact: true })).toHaveValue('')

    await expect(page.getByRole('button', {
      name: 'Save changes',
      exact: true
    })).toBeDisabled()

    expect(state.requests).toHaveLength(0)
  })

  test('hides editing from ordinary users and guards direct navigation', async ({ context, page }) => {
    await mockEditor(context)

    await signIn(context, page, {
      target: itemPath,
      isAdmin: false
    })

    await page.getByRole('button', {
      name: 'More',
      exact: true
    }).click()

    await expect(page.getByRole('menuitem', {
      name: 'Edit item',
      exact: true
    })).toHaveCount(0)

    await signIn(context, page, { isAdmin: false })
    await expect(page).toHaveURL('/')
  })
})
