import type { BrowserContext, Locator, Page } from '@playwright/test'
import * as v from 'valibot'
import type { MyGearRecord } from '../../../app/types/equipment.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { createDeferred, getElementBox, mockGuestLogin } from '../fixtures/gear-library-entry-list.fixtures.ts'

const catalogRow = {
  id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ab',
  createdAt: '2026-07-23T00:00:00.000Z',
  source: 'catalog',

  item: {
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477ac',
    name: 'Catalog stove',

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
    const body = v.parse(v.object({ customName: v.string() }), raw)

    const row: MyGearRecord = {
      id: method === 'POST' ? `custom-${state.saves}` : id ?? '',
      customName: body.customName,
      createdAt: '2026-10-04T10:00:00.000Z',
      source: 'custom'
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

async function chooseGearAction(card: Locator, action: 'Rename' | 'Remove') {
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
      createdAt: '2026-10-04T10:00:00.000Z'
    }])

    await openMyGear(page)

    const card = page.locator('[data-gear-id="compact"]')
    const cardBox = await getElementBox(card)

    expect(cardBox.height).toBeLessThanOrEqual(128)
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
    const rename = page.getByRole('dialog', { name: 'Rename custom gear' })
    const remove = page.getByRole('dialog', { name: 'Remove custom gear' })

    await test.step('create private gear with the keyboard', async () => {
      await openMyGear(page)
      await page.getByRole('button', { name: 'Add custom gear' }).click()
      await expect(input).toBeFocused()
      await input.fill('  My DIY stove  ')
      await input.press('Enter')
      await expect(create).not.toBeVisible()
      await expect(page.getByText('2 saved items')).toBeVisible()
      await expect(page.getByRole('link', { name: 'My DIY stove' })).toHaveCount(0)
    })

    await test.step('reload and add a second item', async () => {
      await reloadMyGear(page)
      await page.getByRole('button', { name: 'Add custom gear' }).click()
      await create.getByRole('textbox').fill('Another item')
      await create.getByRole('button', { name: 'Add gear' }).click()
      await expect(page.getByText('3 saved items')).toBeVisible()
      await expect(create).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Add custom gear' })).toBeFocused()
    })

    await test.step('cancel a keyboard rename', async () => {
      await expect(custom.getByText('My DIY stove', { exact: true })).toBeVisible()
      await expect(custom.getByText('Custom', { exact: true })).toBeVisible()
      await custom.getByRole('button', { name: /^Actions for /u }).focus()
      await page.keyboard.press('ArrowDown')

      await expect(custom.getByRole('menuitem', {
        name: 'Rename',
        exact: true
      })).toBeFocused()

      await page.keyboard.press('Enter')
      await expect(rename.getByRole('textbox')).toHaveValue('My DIY stove')
      await rename.getByRole('textbox').fill('Cancelled name')
      await page.keyboard.press('Escape')
      await expect(custom.getByRole('button', { name: /^Actions for /u })).toBeFocused()
      expect(state.saves).toBe(2)
    })

    await test.step('rename in place before and after reload', async () => {
      await chooseGearAction(custom, 'Rename')
      await expect(rename.getByRole('textbox')).toHaveValue('My DIY stove')
      await rename.getByRole('textbox').fill('Renamed stove')
      await rename.getByRole('button', { name: 'Save name' }).click()
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
      await expect(page.getByText('2 saved items')).toBeVisible()

      const catalogSelector = `[data-gear-id="${catalogRow.id}"]`

      await expect(page.locator(catalogSelector).getByRole('button', { name: 'Actions for Catalog stove' })).toBeFocused()
      expect(state.removals).toBe(1)
    })
  })

  test('keeps failed input, validates names, and blocks repeat saves', async ({ context, page, expectConsoleError }) => {
    const state = await mockGear(context)
    const dialog = page.getByRole('dialog', { name: 'Add custom gear' })
    const input = dialog.getByRole('textbox')

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

      const failureLog = expectConsoleError(/Failed to save custom gear/u)
      const failureGate = createDeferred()

      state.saveGate = failureGate.promise

      try {
        await input.fill('Retry this name')
        await input.press('Enter')
        await expect(input).toBeDisabled()
        await expect(input).not.toBeFocused()
      } finally {
        failureGate.resolve()
      }

      await failureLog

      await expect(dialog.getByText('Could not save your gear. Try again.')).toBeVisible()
      await expect(input).toHaveValue('Retry this name')
      await expect(input).toBeFocused()
      await expect(dialog).not.toContainText('Private database details')
    })

    await test.step('retry with the keyboard and block repeat saves', async () => {
      state.saveStatus = 200

      const gate = createDeferred()

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
      await expect(page.getByText('1 saved item')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add custom gear' })).toBeFocused()
    })

    await test.step('preserve input and restore focus after failed rename', async () => {
      await page.getByRole('button', { name: 'Actions for Retry this name' }).click()

      await page.getByRole('menuitem', {
        name: 'Rename',
        exact: true
      }).click()

      const rename = page.getByRole('dialog', { name: 'Rename custom gear' })

      state.saveStatus = 500

      const renameLog = expectConsoleError(/Failed to save custom gear/u)
      const renameGate = createDeferred()
      const renameInput = rename.getByRole('textbox')

      state.saveGate = renameGate.promise

      try {
        await renameInput.fill('Keep this edit')
        await renameInput.press('Enter')
        await expect(renameInput).toBeDisabled()
        await expect(renameInput).not.toBeFocused()
      } finally {
        renameGate.resolve()
      }

      await renameLog

      await expect(renameInput).toHaveValue('Keep this edit')
      await expect(renameInput).toBeFocused()
      await expect(rename.getByText('Could not save your gear. Try again.')).toBeVisible()
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
      createdAt: '2026-10-04T10:00:00.000Z'
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

      await expect(dialog.getByRole('alert')).toContainText('Could not remove your gear.')
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

    await expect(page.getByRole('status')).toContainText('Could not remove item.')
    await expect(trigger).toBeFocused()
    await expect(card).toBeVisible()
    expect(state.removals).toBe(1)
  })

})
