import type { BrowserContext, Locator, Page } from '@playwright/test'
import * as v from 'valibot'
import type { MyGearRecord } from '../../../app/types/equipment.ts'
import type { PackingListEntry, PackingListEntryInventory } from '../../../app/types/packing.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { createDeferred, getElementBox, mockGuestLogin } from '../fixtures/gear-library-entry-list.fixtures.ts'

const catalogRow = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ab',
  createdAt: '2026-07-23T00:00:00.000Z',
  source: 'catalog',
  personalName: null,
  measuredWeightGrams: null,
  note: null,
  ownedQuantity: 1,

  item: {
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ac',
    name: 'Catalog stove',
    weightGrams: '20.25',

    brand: {
      name: 'MSR',
      slug: 'msr'
    },

    category: {
      name: 'Stoves',
      slug: 'stoves'
    }
  }
} as const satisfies MyGearRecord

interface GearState {
  rows: MyGearRecord[];
  saveStatus: number;
  removeStatus: number;
  saveGate?: Promise<void>;
  removeGate?: Promise<void>;
  saves: number;
  removals: number;
}

async function mockGear(context: BrowserContext, rows: MyGearRecord[] = []) {
  const state: GearState = {
    rows,
    saveStatus: 200,
    removeStatus: 204,
    saves: 0,
    removals: 0
  }

  await mockGuestLogin(context)

  await context.route(/\/api\/user\/gear(?:\/[^/]+)?$/u, async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new globalThis.URL(request.url())
    const id = url.pathname.split('/').at(-1)

    if (method === 'GET') {
      await route.fulfill({ json: state.rows })

      return
    }

    if (method === 'DELETE') {
      state.removals += 1
      await state.removeGate

      if (state.removeStatus === 204) {
        state.rows = state.rows.filter(row => row.id !== id)
      }

      await route.fulfill({ status: state.removeStatus })

      return
    }

    state.saves += 1
    await state.saveGate

    if (state.saveStatus >= 400) {
      await route.fulfill({
        status: state.saveStatus,
        json: { message: 'Private database details' }
      })

      return
    }

    const raw: unknown = request.postDataJSON()

    const body = v.parse(v.object({
      customName: v.optional(v.string()),
      personalName: v.optional(v.nullable(v.string())),
      note: v.optional(v.nullable(v.string())),
      measuredWeightGrams: v.optional(v.nullable(v.string())),
      ownedQuantity: v.optional(v.number())
    }), raw)

    const priorGear = state.rows.find(row => row.id === id)

    const row: MyGearRecord = priorGear?.source === 'catalog'
      ? {
          ...priorGear,
          personalName: body.personalName ?? null,
          note: body.note ?? null,
          measuredWeightGrams: body.measuredWeightGrams ?? null,
          ownedQuantity: body.ownedQuantity ?? 1
        }
      : {
          id: method === 'POST' ? `custom-${state.saves}` : id ?? '',
          customName: body.customName ?? '',
          createdAt: '2026-10-04T10:00:00.000Z',
          source: 'custom',
          note: body.note ?? null,
          measuredWeightGrams: body.measuredWeightGrams ?? null,
          ownedQuantity: body.ownedQuantity ?? 1
        }

    state.rows = method === 'POST'
      ? [row, ...state.rows]
      : state.rows.map(existing => existing.id === id ? row : existing)

    await route.fulfill({
      status: method === 'POST' ? 201 : 200,
      json: row
    })
  })

  return state
}

async function openMyGear(page: Page) {
  await page.goto('/login?redirectTo=/my-gear')
  await waitForInitialEmailSignInTurnstile(page)

  await page.getByRole('button', {
    name: 'Continue as guest',
    exact: true
  }).click()

  await expect(page.getByRole('heading', {
    name: 'My gear',
    exact: true
  })).toBeVisible()
}

async function reloadMyGear(page: Page) {
  await page.reload()

  // The mocked guest sign-in does not create a server cookie.
  await waitForInitialEmailSignInTurnstile(page)
  await page.getByRole('button', { name: /Continue as guest/iu }).click()
}

async function chooseGearAction(card: Locator, action: 'Edit' | 'Remove') {
  await card.getByRole('button', { name: /^Actions for /u }).click()

  await card.getByRole('menuitem', {
    name: action,
    exact: true
  }).click()
}

test.describe('private custom gear', () => {
  test('keeps short gear cards compact with a single action menu', async ({ context, page }) => {
    await mockGear(context, [{
      id: 'compact',
      source: 'custom',
      customName: 'DIY stove',
      createdAt: '2026-10-04T10:00:00.000Z',
      note: null,
      measuredWeightGrams: null,
      ownedQuantity: 1
    }])

    await openMyGear(page)

    const card = page.locator('[data-gear-id="compact"]')
    const cardBox = await getElementBox(card)

    expect(cardBox.height).toBeLessThanOrEqual(176)
    await expect(card.getByRole('button')).toHaveCount(1)

    const trigger = card.getByRole('button', { name: 'Actions for DIY stove' })
    const triggerBox = await getElementBox(trigger)

    expect(triggerBox.y - cardBox.y).toBeLessThan(24)

    const rightInset = cardBox.x + cardBox.width - triggerBox.x - triggerBox.width

    expect(rightInset).toBeLessThan(24)
    await expect(trigger).toBeVisible()

    const screenshotPath = test.info().outputPath('my-gear-compact.png')

    await page.screenshot({
      path: screenshotPath,
      animations: 'disabled'
    })
  })

  test('creates, reloads, renames in place, and confirms removal in a mixed list', async ({ context, page }) => {
    const state = await mockGear(context, [catalogRow])
    const custom = page.locator('[data-gear-id="custom-1"]')
    const create = page.getByRole('dialog', { name: 'Add custom gear' })
    const input = create.getByRole('textbox', { name: 'Gear name' })
    const rename = page.getByRole('dialog', { name: 'Edit gear' })
    const remove = page.getByRole('dialog', { name: 'Remove custom gear' })

    await test.step('create private gear with the keyboard', async () => {
      await openMyGear(page)
      await page.getByRole('button', { name: 'Add custom gear' }).click()
      await expect(input).toBeFocused()
      await input.fill('  My DIY stove  ')
      await input.press('Enter')
      await expect(create).not.toBeVisible()
      await expect(page.getByText('2 saved entries')).toBeVisible()
      await expect(page.getByRole('link', { name: 'My DIY stove' })).toHaveCount(0)
    })

    await test.step('reload and add a second item', async () => {
      await reloadMyGear(page)
      await page.getByRole('button', { name: 'Add custom gear' }).click()

      await create.getByRole('textbox', {
        name: 'Gear name',
        exact: true
      }).fill('Another item')

      await create.getByRole('button', { name: 'Add gear' }).click()
      await expect(page.getByText('3 saved entries')).toBeVisible()
      await expect(create).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Add custom gear' })).toBeFocused()
    })

    await test.step('cancel a keyboard rename', async () => {
      await expect(custom.getByText('My DIY stove', { exact: true })).toBeVisible()
      await expect(custom.getByText('Custom', { exact: true })).toBeVisible()
      await custom.getByRole('button', { name: /^Actions for /u }).focus()
      await page.keyboard.press('ArrowDown')

      await expect(custom.getByRole('menuitem', {
        name: 'Edit',
        exact: true
      })).toBeFocused()

      await page.keyboard.press('Enter')

      await expect(rename.getByRole('textbox', {
        name: 'Gear name',
        exact: true
      })).toHaveValue('My DIY stove')

      await rename.getByRole('textbox', {
        name: 'Gear name',
        exact: true
      }).fill('Cancelled name')

      await page.keyboard.press('Escape')
      await expect(custom.getByRole('button', { name: /^Actions for /u })).toBeFocused()
      expect(state.saves).toBe(2)
    })

    await test.step('rename in place before and after reload', async () => {
      await chooseGearAction(custom, 'Edit')

      await expect(rename.getByRole('textbox', {
        name: 'Gear name',
        exact: true
      })).toHaveValue('My DIY stove')

      await rename.getByRole('textbox', {
        name: 'Gear name',
        exact: true
      }).fill('Renamed stove')

      await rename.getByRole('button', { name: 'Save changes' }).click()
      await expect(rename).not.toBeVisible()
      await expect(custom.getByText('Renamed stove', { exact: true })).toBeVisible()
      await expect(page.locator('[data-gear-id]')).toHaveText([/Another item/u, /Renamed stove/u, /Catalog stove/u])
      await reloadMyGear(page)
      await expect(page.locator('[data-gear-id]')).toHaveText([/Another item/u, /Renamed stove/u, /Catalog stove/u])
    })

    await test.step('cancel and confirm removal', async () => {
      await chooseGearAction(custom, 'Remove')
      await expect(remove).toContainText('Renamed stove')
      await remove.getByRole('button', { name: 'Cancel' }).click()
      expect(state.removals).toBe(0)
      await expect(custom.getByRole('button', { name: /^Actions for /u })).toBeFocused()
      await chooseGearAction(custom, 'Remove')
      await remove.getByRole('button', { name: 'Remove gear' }).click()
      await expect(custom).toHaveCount(0)
      await expect(page.getByText('2 saved entries')).toBeVisible()

      const catalogSelector = `[data-gear-id="${catalogRow.id}"]`

      await expect(page.locator(catalogSelector).getByRole('button', { name: 'Actions for Catalog stove' })).toBeFocused()
      expect(state.removals).toBe(1)
    })
  })

  test('keeps failed input, validates names, and blocks repeat saves', async ({ context, page, expectConsoleError }) => {
    const state = await mockGear(context)
    const dialog = page.getByRole('dialog', { name: 'Add custom gear' })
    const rename = page.getByRole('dialog', { name: 'Edit gear' })
    const createdCard = page.locator('[data-gear-id="custom-2"]')

    const input = dialog.getByRole('textbox', {
      name: 'Gear name',
      exact: true
    })

    const noteInput = dialog.getByRole('textbox', {
      name: 'Note',
      exact: true
    })

    const weightInput = dialog.getByRole('textbox', {
      name: 'Measured weight per item',
      exact: true
    })

    const quantityInput = dialog.getByRole('textbox', {
      name: 'Owned quantity',
      exact: true
    })

    const renameInput = rename.getByRole('textbox', {
      name: 'Gear name',
      exact: true
    })

    const renameNoteInput = rename.getByRole('textbox', {
      name: 'Note',
      exact: true
    })

    const renameWeightInput = rename.getByRole('textbox', {
      name: 'Measured weight per item',
      exact: true
    })

    const renameQuantityInput = rename.getByRole('textbox', {
      name: 'Owned quantity',
      exact: true
    })

    await test.step('reject invalid names locally', async () => {
      await openMyGear(page)
      await expect(page.getByText('No saved gear yet.')).toBeVisible()
      await page.getByRole('button', { name: 'Add custom gear' }).click()
      await input.fill('   ')
      await input.press('Enter')
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(input).toBeFocused()

      const tooLongName = 'a'.repeat(129)

      await input.fill(tooLongName)
      await input.press('Enter')
      await expect(dialog.getByText('Use 128 characters or fewer.')).toBeVisible()
      expect(state.saves).toBe(0)
    })

    await test.step('preserve input and restore focus after failed creation', async () => {
      state.saveStatus = 500

      const failureLog = expectConsoleError(/Failed to save gear/u)
      const failureGate = createDeferred()

      state.saveGate = failureGate.promise

      try {
        await input.fill('Retry this name')
        await noteInput.fill('Without case\nKeep dry')
        await weightInput.fill('18.123456789123456789')
        await quantityInput.fill('2')
        await input.press('Enter')
        await expect(input).toBeDisabled()
        await expect(input).not.toBeFocused()
      } finally {
        failureGate.resolve()
      }

      await failureLog

      await expect(dialog.getByText('Could not save your gear. Try again.')).toBeVisible()
      await expect(input).toHaveValue('Retry this name')
      await expect(noteInput).toHaveValue('Without case\nKeep dry')
      await expect(weightInput).toHaveValue('18.123456789123456789')
      await expect(quantityInput).toHaveValue('2')
      await expect(input).toBeFocused()
      await expect(dialog).not.toContainText('Private database details')
    })

    await test.step('retry with the keyboard and block repeat saves', async () => {
      state.saveStatus = 200

      const gate = createDeferred()
      const requestPromise = page.waitForRequest('**/api/user/gear')

      state.saveGate = gate.promise

      try {
        await page.keyboard.press('Enter')
        await expect(input).toBeDisabled()
        await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
        await page.keyboard.press('Escape')
        await expect(dialog).toBeVisible()
        await dialog.getByRole('button', { name: 'Add gear' }).dispatchEvent('click')
        expect(state.saves).toBe(2)
      } finally {
        gate.resolve()
      }

      await expect(dialog).not.toBeVisible()

      const request = await requestPromise
      const body: unknown = request.postDataJSON()

      expect(request.method()).toBe('POST')

      expect(body).toStrictEqual({
        customName: 'Retry this name',
        note: 'Without case\nKeep dry',
        measuredWeightGrams: '18.123456789123456789',
        ownedQuantity: 2
      })

      await expect(createdCard).toContainText('Without case\nKeep dry')
      await expect(createdCard).toContainText('Measured weight: 18.123456789123456789 g per item')
      await expect(createdCard).toContainText('Owned quantity: 2')
      await expect(page.getByText('1 saved entry')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add custom gear' })).toBeFocused()
    })

    await test.step('preserve input and restore focus after failed rename', async () => {
      await page.getByRole('button', { name: 'Actions for Retry this name' }).click()

      await page.getByRole('menuitem', {
        name: 'Edit',
        exact: true
      }).click()

      state.saveStatus = 500

      const renameLog = expectConsoleError(/Failed to save gear/u)
      const renameGate = createDeferred()

      state.saveGate = renameGate.promise

      try {
        await renameInput.fill('Keep this edit')
        await renameNoteInput.fill('Use with lid\nKeep upright')
        await renameWeightInput.fill('21.987654321987654321')
        await renameQuantityInput.fill('3')
        await renameInput.press('Enter')
        await expect(renameInput).toBeDisabled()
        await expect(renameInput).not.toBeFocused()
      } finally {
        renameGate.resolve()
      }

      await renameLog

      await expect(renameInput).toHaveValue('Keep this edit')
      await expect(renameNoteInput).toHaveValue('Use with lid\nKeep upright')
      await expect(renameWeightInput).toHaveValue('21.987654321987654321')
      await expect(renameQuantityInput).toHaveValue('3')
      await expect(renameInput).toBeFocused()
      await expect(rename.getByText('Could not save your gear. Try again.')).toBeVisible()
      await expect(createdCard).toContainText('Retry this name')
      await expect(createdCard).toContainText('Without case\nKeep dry')
      await expect(createdCard).toContainText('Measured weight: 18.123456789123456789 g per item')
      await expect(createdCard).toContainText('Owned quantity: 2')
    })

    await test.step('retry the edited details and update the same card', async () => {
      state.saveStatus = 200

      const requestPromise = page.waitForRequest('**/api/user/gear/custom-2')

      await page.keyboard.press('Enter')
      await expect(rename).not.toBeVisible()

      const request = await requestPromise
      const body: unknown = request.postDataJSON()

      expect(request.method()).toBe('PATCH')

      expect(body).toStrictEqual({
        customName: 'Keep this edit',
        note: 'Use with lid\nKeep upright',
        measuredWeightGrams: '21.987654321987654321',
        ownedQuantity: 3
      })

      await expect(createdCard).toContainText('Keep this edit')
      await expect(createdCard).toContainText('Use with lid\nKeep upright')
      await expect(createdCard).toContainText('Measured weight: 21.987654321987654321 g per item')
      await expect(createdCard).toContainText('Owned quantity: 3')
      await expect(page.getByText('1 saved entry')).toBeVisible()
      await expect(createdCard.getByRole('button', { name: 'Actions for Keep this edit' })).toBeFocused()
      expect(state.saves).toBe(4)
    })
  })

  test('fits long names on mobile, retains removal errors, and focuses add after the final removal', async ({ context, page, expectConsoleError }) => {
    const name = 'Custom'.repeat(21)
    const card = page.locator('[data-gear-id="long"]')
    const menu = card.getByRole('menu')
    const dialog = page.getByRole('dialog', { name: 'Remove custom gear' })

    const state = await mockGear(context, [{
      id: 'long',
      source: 'custom',
      customName: name,
      createdAt: '2026-10-04T10:00:00.000Z',
      note: null,
      measuredWeightGrams: null,
      ownedQuantity: 1
    }])

    await test.step('fit long names and the action menu on mobile', async () => {
      await page.setViewportSize({
        width: 320,
        height: 740
      })

      await openMyGear(page)

      const nameText = card.getByText(name, { exact: true })
      const elements = [nameText, card.getByRole('button', { name: /^Actions for /u })]
      const boxPromises = elements.map(async element => getElementBox(element))
      const boxes = await Promise.all(boxPromises)

      for (const box of boxes) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(320)
      }

      const fits = await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth)

      expect(fits).toBe(true)
      await card.getByRole('button', { name: /^Actions for /u }).click()

      const menuBox = await getElementBox(menu)

      expect(menuBox.x).toBeGreaterThanOrEqual(0)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(320)
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(740)

      const screenshotPath = test.info().outputPath('my-gear-mobile-menu.png')

      await page.screenshot({
        path: screenshotPath,
        animations: 'disabled'
      })
    })

    await test.step('retain the item and restore focus after failed removal', async () => {
      await menu.getByRole('menuitem', {
        name: 'Remove',
        exact: true
      }).click()

      state.removeStatus = 409

      const failureLog = expectConsoleError(/Failed to remove gear/u)
      const removeGate = createDeferred()
      const confirmButton = dialog.getByRole('button', { name: 'Remove gear' })

      state.removeGate = removeGate.promise

      try {
        await confirmButton.focus()
        await page.keyboard.press('Enter')
        await expect(confirmButton).toBeDisabled()
        await expect(confirmButton).not.toBeFocused()
      } finally {
        removeGate.resolve()
      }

      await failureLog

      await expect(dialog.getByRole('alert')).toContainText('This gear is used in a packing list. Remove it from all lists first.')
      await expect(dialog).toContainText(name)
      await expect(confirmButton).toBeFocused()
      expect(state.rows).toHaveLength(1)
    })

    await test.step('retry removal with the keyboard and focus Add', async () => {
      state.removeStatus = 204

      await page.keyboard.press('Enter')
      await expect(dialog).not.toBeVisible()
      await expect(page.getByText('No saved gear yet.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add custom gear' })).toBeFocused()
    })
  })

  test('restores the catalog action trigger after failed removal', async ({ context, page, expectConsoleError }) => {
    const state = await mockGear(context, [catalogRow])
    const gate = createDeferred()
    const catalogSelector = `[data-gear-id="${catalogRow.id}"]`
    const card = page.locator(catalogSelector)
    const trigger = card.getByRole('button', { name: 'Actions for Catalog stove' })

    state.removeStatus = 409
    state.removeGate = gate.promise

    await openMyGear(page)

    const failureLog = expectConsoleError(/Failed to remove gear/u)

    try {
      await trigger.focus()
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('End')

      await expect(card.getByRole('menuitem', {
        name: 'Remove',
        exact: true
      })).toBeFocused()

      await page.keyboard.press('Enter')
      await expect(trigger).toBeDisabled()
      await expect(trigger).not.toBeFocused()
    } finally {
      gate.resolve()
    }

    await failureLog

    await expect(page.getByRole('status')).toContainText('This gear is used in a packing list. Remove it from all lists first.')
    await expect(trigger).toBeFocused()
    await expect(card).toBeVisible()
    expect(state.removals).toBe(1)

    state.removeStatus = 500

    const retryFailureLog = expectConsoleError(/Failed to remove gear/u)

    await page.keyboard.press('ArrowDown')
      await page.keyboard.press('End')

    await expect(card.getByRole('menuitem', {
      name: 'Remove',
      exact: true
    })).toBeFocused()

    await page.keyboard.press('Enter')

    await retryFailureLog

    await expect(page.getByRole('status')).toContainText('Could not remove item.')
    await expect(trigger).toBeFocused()
    await expect(card).toBeVisible()
    expect(state.removals).toBe(2)

    state.removeStatus = 204

    await page.keyboard.press('ArrowDown')
      await page.keyboard.press('End')

    await expect(card.getByRole('menuitem', {
      name: 'Remove',
      exact: true
    })).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(card).not.toBeVisible()
    await expect(page.getByRole('status')).not.toBeVisible()
    expect(state.removals).toBe(3)
  })

})

async function mockCatalogPackingLists(context: BrowserContext, state: GearState) {
  const listIds = [
    '0195f6e8-8f44-74f6-bc9a-5c8f7df477b1',
    '0195f6e8-8f44-74f6-bc9a-5c8f7df477b2',
    '0195f6e8-8f44-74f6-bc9a-5c8f7df477b3'
  ]

  const names = ['First personal trip', 'Second personal trip', 'Picker trip']
  const date = '2026-10-16T00:00:00.000Z'

  await context.route(/\/api\/user\/packing-lists(?:\/[^/]+(?:\/available-gear)?)?(?:\?.*)?$/u, async route => {
    const request = route.request()
    const requestUrl = request.url()
    const url = new globalThis.URL(requestUrl)
    const parts = url.pathname.split('/')
    const listId = parts.at(4) ?? ''
    const index = listIds.indexOf(listId)
    const row = state.rows.find(gear => gear.id === catalogRow.id)
    const alias = row?.source === 'catalog' ? row.personalName ?? row.item.name : ''

    const inventory = {
      source: 'catalog',
      inventoryId: catalogRow.id,
      itemName: alias,
      brand: 'MSR',
      category: 'Stoves'
    } as const satisfies PackingListEntryInventory

    if (parts.at(-1) === 'available-gear') {
      await route.fulfill({ json: {
        items: [inventory],
        nextPage: null
      } })

      return
    }

    if (index === -1) {
      const lists = listIds.map((id, listIndex) => {
        const entryCount = listIndex === 2 ? 0 : 1

        return {
          id,
          name: names[listIndex],
          createdAt: date,
          updatedAt: date,
          entryCount,
          packedCount: 0
        }
      })

      await route.fulfill({ json: lists })

      return
    }

    const entryId = `entry-${index}`

    const entries = index === 2 ? [] : [{
      id: entryId,
      customName: null,
      source: 'inventory',
      inventory,
      isPacked: false,
      quantity: 1,
      weightGrams: catalogRow.item.weightGrams,
      weightSource: 'catalog',
      createdAt: date,
      updatedAt: date
    }] satisfies PackingListEntry[]

    await route.fulfill({ json: {
      id: listId,
      name: names[index],
      createdAt: date,
      updatedAt: date,
      entries
    } })
  })

}

test.describe('personal gear details', () => {
  test('creates all private fields and edits catalog details with exact weight, safe notes, and fallback', async ({ context, page }) => {
    const catalogSelector = `[data-gear-id="${catalogRow.id}"]`
    const card = page.locator(catalogSelector)
    const edit = page.getByRole('dialog', { name: 'Edit gear' })

    const personalName = edit.getByRole('textbox', {
      name: 'Personal name',
      exact: true
    })

    const weight = edit.getByRole('textbox', {
      name: 'Measured weight per item',
      exact: true
    })

    await test.step('create private gear with all personal details', async () => {
      await mockGear(context, [catalogRow])
      await openMyGear(page)

      await page.getByRole('button', {
        name: 'Add custom gear',
        exact: true
      }).click()

      const create = page.getByRole('dialog', { name: 'Add custom gear' })

      await create.getByRole('textbox', {
        name: 'Gear name',
        exact: true
      }).fill('My spoon')

      await create.getByRole('textbox', {
        name: 'Note',
        exact: true
      }).fill('Without case\nKeep dry')

      await create.getByRole('textbox', {
        name: 'Measured weight per item',
        exact: true
      }).fill('18.123456789123456789')

      await create.getByRole('textbox', {
        name: 'Owned quantity',
        exact: true
      }).fill('2')

      await create.getByRole('button', {
        name: 'Add gear',
        exact: true
      }).click()

      const custom = page.locator('[data-gear-id="custom-1"]')

      await expect(custom).toContainText('Measured weight: 18.123456789123456789 g per item')
      await expect(custom).toContainText('Owned quantity: 2')
      await expect(custom).toContainText('Without case\nKeep dry')
    })

    await test.step('edit catalog details with zero weight and safe note text', async () => {
      await expect(card).toContainText('Catalog weight: 20.25 g per item')
      await chooseGearAction(card, 'Edit')
      await expect(personalName).toHaveValue('')
      await expect(weight).toHaveValue('')
      await expect(edit.getByText('Leave blank to use catalog weight: 20.25 g.')).toBeVisible()
      await expect(weight).toHaveAccessibleDescription('Unit: g Leave blank to use catalog weight: 20.25 g.')
      await personalName.fill('My green stove')

      await edit.getByRole('textbox', {
        name: 'Note',
        exact: true
      }).fill('<b>Keep dry</b>\nWithout case')

      await weight.fill('0')

      await edit.getByRole('textbox', {
        name: 'Owned quantity',
        exact: true
      }).fill('3')

      await edit.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect(card).toContainText('My green stove')
      await expect(card).toContainText('Measured weight: 0 g per item')
      await expect(card).toContainText('Owned quantity: 3')

      await expect(card.getByRole('link', {
        name: 'Catalog stove',
        exact: true
      })).toBeVisible()

      await expect(card.getByText('<b>Keep dry</b>\nWithout case', { exact: true })).toBeVisible()
      await expect(card.locator('b')).toHaveCount(0)

      await expect(card.getByRole('button', {
        name: 'Actions for My green stove',
        exact: true
      })).toBeFocused()
    })

    await test.step('clear personal overrides and restore catalog fallback', async () => {
      await chooseGearAction(card, 'Edit')
      await expect(personalName).toHaveValue('My green stove')
      await expect(weight).toHaveValue('0')
      await personalName.fill('')
      await weight.fill('')

      await edit.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect(card).toContainText('Catalog weight: 20.25 g per item')
      await expect(card).not.toContainText('My green stove')
      await expect(card).toContainText('Owned quantity: 3')
    })
  })

  test('validates measurements and quantity while retaining long text in a usable mobile form', async ({ context, page }) => {
    const dialog = page.getByRole('dialog', { name: 'Add custom gear' })
    const longName = 'Long'.repeat(32)
    const longNote = 'Unbroken'.repeat(250)

    const name = dialog.getByRole('textbox', {
      name: 'Gear name',
      exact: true
    })

    const weight = dialog.getByRole('textbox', {
      name: 'Measured weight per item',
      exact: true
    })

    const quantity = dialog.getByRole('textbox', {
      name: 'Owned quantity',
      exact: true
    })

    await test.step('reject invalid measurements and quantity in the mobile form', async () => {
      await mockGear(context)

      await page.setViewportSize({
        width: 320,
        height: 740
      })

      await openMyGear(page)

      await page.getByRole('button', {
        name: 'Add custom gear',
        exact: true
      }).click()

      await name.fill(longName)

      await dialog.getByRole('textbox', {
        name: 'Note',
        exact: true
      }).fill(longNote)

      await weight.fill('-1')
      await quantity.fill('0')

      await dialog.getByRole('button', {
        name: 'Add gear',
        exact: true
      }).click()

      await expect(weight).toHaveAttribute('aria-invalid', 'true')
      await expect(weight).toBeFocused()
      await expect(quantity).toHaveAttribute('aria-invalid', 'true')
    })

    await test.step('correct the invalid fields and save the retained long text', async () => {
      await weight.fill('18.25')
      await quantity.fill('2')

      await dialog.getByRole('button', {
        name: 'Add gear',
        exact: true
      }).click()

      await expect(dialog).not.toBeVisible()
    })

    await test.step('keep the saved card and long note inside the mobile width', async () => {
      const card = page.locator('[data-gear-id="custom-1"]')

      await expect(card).toContainText('18.25 g per item')

      const cardBox = await getElementBox(card)
      const note = card.getByText(longNote, { exact: true })
      const noteBox = await getElementBox(note)

      expect(cardBox.x).toBeGreaterThanOrEqual(0)
      expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(320)
      expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width)
    })
  })

  test('shows an edited catalog name after navigation in two existing lists and the saved-gear picker', async ({ context, page }) => {
    const state = await mockGear(context, [catalogRow])
    const sidebar = page.getByTestId('shell-sidebar')

    await test.step('observe the original catalog name in an existing list', async () => {
      await mockCatalogPackingLists(context, state)
      await openMyGear(page)

      await sidebar.getByRole('link', {
        name: 'Packing lists',
        exact: true
      }).click()

      await page.getByRole('link', { name: /First personal trip/u }).click()
      await expect(page.getByRole('checkbox', { name: /Catalog stove/u })).toBeVisible()
    })

    await test.step('edit the catalog name in saved gear', async () => {
      await sidebar.getByRole('link', {
        name: 'My gear',
        exact: true
      }).click()

      const catalogSelector = `[data-gear-id="${catalogRow.id}"]`
      const catalogCard = page.locator(catalogSelector)

      await chooseGearAction(catalogCard, 'Edit')

      const edit = page.getByRole('dialog', { name: 'Edit gear' })

      await edit.getByRole('textbox', {
        name: 'Personal name',
        exact: true
      }).fill('My green stove')

      await edit.getByRole('button', {
        name: 'Save changes',
        exact: true
      }).click()

      await expect(edit).not.toBeVisible()
    })

    await test.step('revisit both existing lists with the edited name', async () => {
      await sidebar.getByRole('link', {
        name: 'Packing lists',
        exact: true
      }).click()

      await page.getByRole('link', { name: /First personal trip/u }).click()
      await expect(page.getByRole('checkbox', { name: /My green stove/u })).toBeVisible()

      await sidebar.getByRole('link', {
        name: 'Packing lists',
        exact: true
      }).click()

      await page.getByRole('link', { name: /Second personal trip/u }).click()
      await expect(page.getByRole('checkbox', { name: /My green stove/u })).toBeVisible()
    })

    await test.step('show the edited name in the saved-gear picker', async () => {
      await sidebar.getByRole('link', {
        name: 'Packing lists',
        exact: true
      }).click()

      await page.getByRole('link', { name: /Picker trip/u }).click()
      await expect(page.getByRole('button', { name: /My green stove.*Add/u })).toBeVisible()
    })
  })
})
