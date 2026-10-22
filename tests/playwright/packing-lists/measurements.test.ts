import type { BrowserContext, Page } from '@playwright/test'
import * as v from 'valibot'
import type { PackingListDetail, PackingListEntry } from '../../../app/types/packing'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'
import { mockGuestLogin, createDeferred } from '../fixtures/gear-library-entry-list.fixtures.ts'

const listId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const date = '2026-10-17T10:00:00.000Z'
const textName = 'Borrowed mug'

const patchSchema = v.strictObject({
  quantity: v.optional(v.number()),
  weightGrams: v.optional(v.nullable(v.string())),
  isPacked: v.optional(v.boolean())
})

interface State {
  detail: PackingListDetail;
  bodies: unknown[];
  fail: boolean;
  gate: Promise<void> | null;
}
function required<Value>(value: Value | null | undefined): Value {
  if (value === null || value === undefined) { throw new Error('Missing browser fixture or bounds') }

  return value
}
function textEntry(name = textName): PackingListEntry {
  return {
    id: 'text',
    source: 'custom',
    customName: name,
    quantity: 1,
    weightGrams: null,
    weightSource: null,
    isPacked: true,
    createdAt: date,
    updatedAt: date
  }
}
function inventoryEntry(source: 'catalog' | 'custom'): PackingListEntry {
  const inventory = source === 'catalog'
    ? {
      source,
      brand: 'MSR',
      category: 'Tents',
      inventoryId: 'catalog',
      itemName: 'Tent'
    }
    : {
      source,
      inventoryId: 'private',
      itemName: 'Private stove'
    }

  return {
    id: source,
    source: 'inventory',
    inventory,
    customName: null,
    quantity: 1,
    weightGrams: source === 'catalog' ? '123.456' : '0',
    weightSource: source === 'catalog' ? 'catalog' : 'measured',
    isPacked: false,
    createdAt: date,
    updatedAt: date
  }
}
async function setup(context: BrowserContext, entries: PackingListEntry[]) {
  const state: State = {
    detail: {
      id: listId,
      name: 'Trip',
      entries,
      createdAt: date,
      updatedAt: date
    },

    bodies: [],
    fail: false,
    gate: null
  }

  await mockGuestLogin(context)

  await context.route('**/api/user/packing-lists**', async (route) => {
    const request = route.request()
    const path = new globalThis.URL(request.url()).pathname

    if (request.method() === 'PATCH') {
      const raw: unknown = request.postDataJSON()
      const body = v.parse(patchSchema, raw)

      state.bodies.push(body)

      await state.gate

      if (state.fail) {
        state.fail = false

        await route.fulfill({
          status: 500,
          json: { message: 'Internal detail that must stay hidden' }
        })

        return
      }

      const entry = state.detail.entries.find(row => path.endsWith(`/${row.id}`))

      if (entry === undefined) { throw new Error('Missing entry') }

      if (body.quantity !== undefined) { entry.quantity = body.quantity }

      if (body.isPacked !== undefined) { entry.isPacked = body.isPacked }

      if (body.weightGrams !== undefined) {
        entry.weightGrams = body.weightGrams
        entry.weightSource = body.weightGrams === null ? null : 'custom'
      }

      entry.updatedAt = new Date(Date.parse(date) + state.bodies.length * 1000).toISOString()
      state.detail.updatedAt = entry.updatedAt

      await route.fulfill({ json: {
        entry,
        packingListUpdatedAt: state.detail.updatedAt
      } })
    } else if (path.endsWith('/available-gear')) {
      await route.fulfill({ json: {
        items: [],
        nextPage: null
      } })
    } else if (path.endsWith(listId)) {
      await route.fulfill({ json: state.detail })
    } else {
      await route.fulfill({ json: [{
        id: listId,
        name: 'Trip',
        createdAt: date,
        updatedAt: state.detail.updatedAt,
        entryCount: entries.length,
        packedCount: state.detail.entries.filter(entry => entry.isPacked).length
      }] })
    }
  })

  return state
}
async function signIn(page: Page) {
  await page.goto(`/login?redirectTo=${encodeURIComponent(`/packing-lists/${listId}`)}`)
  await waitForInitialEmailSignInTurnstile(page)

  await page.getByRole('button', {
    name: 'Continue as guest',
    exact: true
  }).click()

  await expect(page.getByRole('heading', {
    name: 'Trip',
    exact: true
  })).toBeVisible()
}

test.describe('Packing entry quantity and per-item weight', () => {
  test('validates drafts, cancels and skips unchanged saves, retries errors and restores keyboard focus after a confirmed save', async ({ context, page, expectConsoleError }) => {
    const state = await setup(context, [textEntry()])

    await signIn(page)

    const summary = page.getByRole('region', {
      name: 'All planned gear weight',
      includeHidden: true
    })

    await expect(summary).toContainText('Total weight: Unknown')
    await expect(summary).toContainText('Unknown weight: 1 entry')
    await expect(summary.getByText('No items', { exact: true })).toHaveCount(0)

    const edit = page.getByRole('button', {
      name: `Edit ${textName}`,
      exact: true
    })

    const dialog = page.getByRole('dialog', { name: `Edit ${textName}` })

    const quantity = dialog.getByRole('textbox', {
      name: 'Quantity',
      exact: true
    })

    const weight = dialog.getByRole('textbox', {
      name: 'Weight per item',
      exact: true
    })

    const save = dialog.getByRole('button', { name: 'Save changes' })

    await test.step('Cancels a draft and restores the trigger focus', async () => {
      await edit.focus()
      await page.keyboard.press('Enter')
      await expect(quantity).toBeFocused()
      await quantity.fill('5')
      await weight.fill('1.25')
      await expect(summary).toContainText('Total weight: Unknown')
      await dialog.getByRole('button', { name: 'Cancel' }).click()
      await expect(edit).toBeFocused()
      await expect(summary).toContainText('Total weight: Unknown')
      expect(state.bodies).toStrictEqual([])
    })

    await test.step('Skips unchanged values and resets the draft', async () => {
      await edit.click()
      await expect(quantity).toHaveValue('1')
      await expect(weight).toHaveValue('')
      await save.click()
      await expect(dialog).not.toBeVisible()
      expect(state.bodies).toStrictEqual([])
    })

    await test.step('Validates quantity and weight without a request', async () => {
      await edit.click()
      await quantity.fill('1.5')
      await weight.fill('-1')
      await save.click()
      await expect(quantity).toBeFocused()
      await expect(quantity).toHaveAttribute('aria-invalid', 'true')
      await quantity.fill('3')
      await save.click()
      await expect(weight).toBeFocused()
      await expect(weight).toHaveAttribute('aria-invalid', 'true')
      await weight.fill('123.456789012345678901')
    })

    await test.step('Preserves the draft after a failed save', async () => {
      state.fail = true

      const expectedError = expectConsoleError(/Failed to edit packing list entry/u)

      await save.click()

      await expectedError

      await expect(dialog.getByRole('alert')).toHaveText('Could not save changes. Try again.')
      await expect(quantity).toHaveValue('3')
      await expect(weight).toHaveValue('123.456789012345678901')
      await expect(summary).toContainText('Total weight: Unknown')
      await expect(summary).toContainText('Unknown weight: 1 entry')
    })

    await test.step('Locks pending actions and confirms saved values', async () => {
      const gate = createDeferred()

      state.gate = gate.promise

      await save.click()
      await expect(save).toBeDisabled()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
      await expect(page.getByText('Quantity: 1 · Weight unknown')).toBeVisible()
      await expect(summary).toContainText('Total weight: Unknown')
      expect(state.bodies).toHaveLength(2)
      gate.resolve()
      await expect(dialog).not.toBeVisible()
      await expect(edit).toBeFocused()
      await expect(page.getByText('Quantity: 3 · 123.456789012345678901 g per item · Custom')).toBeVisible()
      await expect(page.getByRole('checkbox', { name: textName })).toBeChecked()
      await expect(page.getByText('1 of 1 packed · All packed')).toBeVisible()
      await expect(summary).toContainText('Total weight: 370.37 g')
      await expect(summary).toContainText('Unknown weight: 0 entries')

      expect(state.bodies).toStrictEqual([{
        quantity: 3,
        weightGrams: '123.456789012345678901'
      }, {
        quantity: 3,
        weightGrams: '123.456789012345678901'
      }])
    })

    await test.step('Reloads the exact saved measurements', async () => {
      await page.reload()

      // Mocked guest creation does not create an SSR session cookie.
      await waitForInitialEmailSignInTurnstile(page)

      await page.getByRole('button', {
        name: 'Continue as guest',
        exact: true
      }).click()

      await expect(page.getByText('Quantity: 3 · 123.456789012345678901 g per item · Custom')).toBeVisible()
      await expect(summary).toContainText('Total weight: 370.37 g')
    })

    await test.step('Keeps known zero distinct from unknown weight', async () => {
      await edit.click()
      await weight.fill('0')
      await save.click()
      await expect(page.getByText('Quantity: 3 · 0 g per item · Custom')).toBeVisible()
      await expect(summary).toContainText('Total weight: 0 g')
      await expect(summary).toContainText('Unknown weight: 0 entries')
      await expect(summary.getByText('No items', { exact: true })).toHaveCount(0)
      await edit.click()
      await weight.fill('1000.5')
      await save.click()
      await expect(summary).toContainText('Total weight: 3.002 kg')
      await edit.click()
      await weight.fill('')
      await save.click()
      await expect(page.getByText('Quantity: 3 · Weight unknown')).toBeVisible()
      await expect(summary).toContainText('Total weight: Unknown')
      await expect(summary).toContainText('Unknown weight: 1 entry')
    })
  })

  test('shows catalog and private measured sources and reloads live weight without pinning it to a quantity edit', async ({ context, page }) => {
    const state = await setup(context, [inventoryEntry('catalog'), inventoryEntry('custom'), textEntry()])

    await signIn(page)

    const summary = page.getByRole('region', { name: 'All planned gear weight' })

    await expect(page.getByText('Quantity: 1 · 123.456 g per item · Catalog')).toBeVisible()
    await expect(page.getByText('Quantity: 1 · 0 g per item · Measured')).toBeVisible()
    await expect(summary).toContainText('Known weight: 123.456 g')
    await expect(summary).toContainText('Total is incomplete')
    await expect(summary).toContainText('Unknown weight: 1 entry')

    await page.getByRole('button', {
      name: 'Edit Private stove',
      exact: true
    }).click()

    const dialog = page.getByRole('dialog', { name: 'Edit Private stove' })

    await expect(dialog.getByRole('textbox', { name: 'Weight per item' })).toHaveCount(0)

    await expect(dialog.getByRole('link', {
      name: 'My gear',
      exact: true
    })).toHaveAttribute('href', '/my-gear')

    await dialog.getByRole('textbox', {
      name: 'Quantity',
      exact: true
    }).fill('8')

    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Quantity: 8 · 0 g per item · Measured')).toBeVisible()
    await expect(summary).toContainText('Known weight: 123.456 g')
    expect(state.bodies).toStrictEqual([{ quantity: 8 }])

    const privateEntry = required(state.detail.entries.find(entry => entry.id === 'custom'))

    privateEntry.weightGrams = '45.1234'

    await page.getByTestId('shell-sidebar').getByRole('link', {
      name: 'Packing lists',
      exact: true
    }).click()

    await page.getByRole('link', { name: /Trip/u }).click()
    await expect(page.getByText('Quantity: 8 · 45.1234 g per item · Measured')).toBeVisible()
    await expect(summary).toContainText('Known weight: 484.443 g')
    await expect(summary).toContainText('Unknown weight: 1 entry')

    const checkbox = page.getByRole('checkbox', { name: 'Private stove' })

    await checkbox.focus()
    await page.keyboard.press('Space')
    await expect(checkbox).toBeChecked()
    await expect(checkbox).toBeEnabled()
    await expect(summary).toContainText('Known weight: 484.443 g')
    await expect(summary).toContainText('Unknown weight: 1 entry')
  })

  test('keeps long names, exact weights and row actions within a narrow viewport', async ({ context, page }) => {
    const name = 'LongBorrowedEquipment'.repeat(6)

    await page.setViewportSize({
      width: 320,
      height: 740
    })

    await setup(context, [textEntry(name)])
    await signIn(page)

    const edit = page.getByRole('button', {
      name: `Edit ${name}`,
      exact: true
    })

    await edit.click()

    const dialog = page.getByRole('dialog', { name: `Edit ${name}` })

    await dialog.getByRole('textbox', {
      name: 'Quantity',
      exact: true
    }).fill('2147483647')

    await dialog.getByRole('textbox', {
      name: 'Weight per item',
      exact: true
    }).fill('123456789012345678901234567890.123456789012345678901234567890123')

    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText(/Quantity: 2147483647/u)).toBeVisible()

    const summary = page.getByRole('region', { name: 'All planned gear weight' })

    await expect(summary).toContainText('Total weight: 265121435515141626551514162655151416.266 kg')
    await expect(summary).toContainText('Unknown weight: 0 entries')
    await expect(summary).toHaveAttribute('aria-live', 'polite')
    await expect(summary).toHaveAttribute('aria-atomic', 'true')

    const summaryBounds = await summary.locator('p').evaluateAll(elements => {
      const paragraphBounds = elements.map(element => {
        const rect = element.getBoundingClientRect()

        return {
          left: rect.left,
          right: rect.right
        }
      })

      return paragraphBounds
    })

    for (const rect of summaryBounds) {
      expect(rect.left).toBeGreaterThanOrEqual(0)
      expect(rect.right).toBeLessThanOrEqual(320)
    }

    const row = page.getByRole('listitem').filter({ has: edit })

    const bounds = await row.evaluate(element => {
      const children = [...element.querySelectorAll('p, button, label')]

      return children.map(child => {
        const rect = child.getBoundingClientRect()

        return {
          left: rect.left,
          right: rect.right
        }
      })
    })

    for (const rect of bounds) {
      expect(rect.left).toBeGreaterThanOrEqual(0)
      expect(rect.right).toBeLessThanOrEqual(320)
    }

    expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= 320)).toBe(true)
    await edit.click()

    const headingBounds = required(await dialog.getByRole('heading').boundingBox())

    expect(headingBounds.x).toBeGreaterThanOrEqual(0)
    expect(headingBounds.x + headingBounds.width).toBeLessThanOrEqual(320)
    await page.keyboard.press('Escape')
    await expect(edit).toBeFocused()
  })
})
