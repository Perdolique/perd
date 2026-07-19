import type { Locator, Page } from '@playwright/test'
import { expect, test } from '../fixtures/global.fixtures.ts'

interface ElementBox {
  blockStart: number;
  height: number;
  inlineStart: number;
  width: number;
}

const fixturePath = '/__e2e/modal-dialog'

async function getElementBox(locator: Locator): Promise<ElementBox> {
  const box = await locator.boundingBox()

  if (box === null) {
    throw new Error('Expected element to have a bounding box')
  }

  return {
    blockStart: box.y,
    height: box.height,
    inlineStart: box.x,
    width: box.width
  }
}

async function waitForDialogTransition(dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible()

  await expect.poll(
    async () => dialog.evaluate((element) => globalThis.getComputedStyle(element).opacity)
  ).toBe('1')
}

function getViewportSize(page: Page) {
  const viewport = page.viewportSize()

  if (viewport === null) {
    throw new Error('Expected page to have a viewport')
  }

  return viewport
}

async function expectCentered(dialog: Locator, page: Page): Promise<void> {
  const box = await getElementBox(dialog)
  const viewport = getViewportSize(page)
  const dialogInlineCenter = box.inlineStart + box.width / 2
  const dialogBlockCenter = box.blockStart + box.height / 2
  const viewportInlineCenter = viewport.width / 2
  const viewportBlockCenter = viewport.height / 2
  const inlineOffset = Math.abs(dialogInlineCenter - viewportInlineCenter)
  const blockOffset = Math.abs(dialogBlockCenter - viewportBlockCenter)

  expect(inlineOffset).toBeLessThan(2)
  expect(blockOffset).toBeLessThan(2)
}

async function expectBottomAnchored(dialog: Locator, page: Page): Promise<ElementBox> {
  const box = await getElementBox(dialog)
  const viewport = getViewportSize(page)
  const bottomOffset = Math.abs(box.blockStart + box.height - viewport.height)

  expect(bottomOffset).toBeLessThan(2)

  return box
}

async function expectInlineEndAnchored(dialog: Locator, page: Page): Promise<ElementBox> {
  const box = await getElementBox(dialog)
  const viewport = getViewportSize(page)
  const inlineEndOffset = Math.abs(box.inlineStart + box.width - viewport.width)

  expect(inlineEndOffset).toBeLessThan(2)

  return box
}

async function expectSymmetricInlineInsets(container: Locator, content: Locator): Promise<void> {
  const containerBox = await getElementBox(container)
  const contentBox = await getElementBox(content)
  const containerInlineEnd = containerBox.inlineStart + containerBox.width
  const contentInlineEnd = contentBox.inlineStart + contentBox.width
  const inlineStartInset = contentBox.inlineStart - containerBox.inlineStart
  const inlineEndInset = containerInlineEnd - contentInlineEnd
  const insetDifference = Math.abs(inlineStartInset - inlineEndInset)

  expect(insetDifference).toBeLessThan(1)
}

test.describe('Modal dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(fixturePath)
  })

  test('should keep default and opted-in presentations centered on desktop', async ({ page }) => {
    const centeredOpener = page.getByRole('button', { name: 'Open centered dialog' })

    await centeredOpener.focus()
    await page.keyboard.press('Enter')

    const centeredDialog = page.getByRole('dialog', { name: 'Centered dialog' })

    await waitForDialogTransition(centeredDialog)
    await expectCentered(centeredDialog, page)
    await page.getByRole('button', { name: 'Close centered dialog' }).click()
    await expect(centeredDialog).toHaveCount(0)
    await expect(centeredOpener).toBeFocused()

    const bottomSheetOpener = page.getByRole('button', { name: 'Open bottom sheet' })

    await bottomSheetOpener.focus()
    await page.keyboard.press('Enter')

    const bottomSheetDialog = page.getByRole('dialog', { name: 'Bottom sheet' })

    await waitForDialogTransition(bottomSheetDialog)
    await expectCentered(bottomSheetDialog, page)
    await page.getByRole('button', { name: 'Close bottom sheet' }).click()
    await expect(bottomSheetDialog).toHaveCount(0)
    await expect(bottomSheetOpener).toBeFocused()
  })

  test('should present an accessible bottom sheet on mobile', async ({ page }) => {
    await page.setViewportSize({
      height: 844,
      width: 390
    })

    await page.locator('html').evaluate((element) => {
      element.style.setProperty('--layout-safe-bottom', '24px')
    })

    const opener = page.getByRole('button', { name: 'Open bottom sheet' })

    await opener.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Bottom sheet' })
    const filterInput = dialog.getByLabel('Filter name')
    const closeButton = dialog.getByRole('button', { name: 'Close bottom sheet' })

    await waitForDialogTransition(dialog)

    const box = await expectBottomAnchored(dialog, page)
    const viewport = getViewportSize(page)
    const maximumHeight = viewport.height * 0.9 + 1

    expect(box.inlineStart).toBeCloseTo(0)
    expect(box.width).toBeCloseTo(viewport.width)
    expect(box.height).toBeLessThanOrEqual(maximumHeight)

    const styles = await dialog.evaluate((element) => {
      const computedStyle = globalThis.getComputedStyle(element)

      return {
        overflowY: computedStyle.overflowY,
        overscrollBehaviorY: computedStyle.overscrollBehaviorY,
        paddingBlockEnd: computedStyle.paddingBlockEnd,
        position: computedStyle.position,
        scrollbarGutter: computedStyle.scrollbarGutter
      }
    })

    expect(styles).toStrictEqual({
      overflowY: 'auto',
      overscrollBehaviorY: 'contain',
      paddingBlockEnd: '24px',
      position: 'fixed',
      scrollbarGutter: 'stable both-edges'
    })

    await expectSymmetricInlineInsets(dialog, filterInput)

    await expect(filterInput).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(opener).not.toBeFocused()
    await page.keyboard.press('Tab')
    await expect(filterInput).toBeFocused()

    await page.mouse.click(viewport.width / 2, viewport.height - 2)
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()

    await opener.click()
    await waitForDialogTransition(dialog)
    await page.mouse.click(1, 1)
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('should present an accessible side sheet on medium desktop', {
    tag: '@dialog-compatibility'
  }, async ({ page }) => {
    await page.setViewportSize({
      height: 768,
      width: 1024
    })

    const opener = page.getByRole('button', { name: 'Open side sheet' })

    await opener.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Side sheet' })
    const title = dialog.getByRole('heading', { name: 'Side sheet' })
    const filterInput = dialog.getByLabel('Side filter name')

    await waitForDialogTransition(dialog)
    await expect(title).toBeFocused()

    const box = await expectInlineEndAnchored(dialog, page)
    const viewport = getViewportSize(page)

    expect(box.blockStart).toBeCloseTo(0)
    expect(box.height).toBeCloseTo(viewport.height)
    expect(box.width).toBeCloseTo(384)

    const styles = await dialog.evaluate((element) => {
      const computedStyle = globalThis.getComputedStyle(element)

      return {
        overflowY: computedStyle.overflowY,
        overscrollBehaviorY: computedStyle.overscrollBehaviorY,
        position: computedStyle.position,
        scrollbarGutter: computedStyle.scrollbarGutter
      }
    })

    expect(styles).toStrictEqual({
      overflowY: 'auto',
      overscrollBehaviorY: 'contain',
      position: 'fixed',
      scrollbarGutter: 'stable both-edges'
    })

    await expectSymmetricInlineInsets(dialog, filterInput)

    await page.setViewportSize({
      height: 900,
      width: 1440
    })

    await waitForDialogTransition(dialog)

    const wideBox = await expectInlineEndAnchored(dialog, page)

    expect(wideBox.blockStart).toBeCloseTo(0)
    expect(wideBox.height).toBeCloseTo(900)
    expect(wideBox.width).toBeCloseTo(384)

    await page.keyboard.press('Tab')
    await expect(filterInput).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await opener.click()
    await waitForDialogTransition(dialog)
    await page.mouse.click(1, 1)
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('should block close requests while close is disabled', {
    tag: '@dialog-compatibility'
  }, async ({ page }) => {
    await page.setViewportSize({
      height: 844,
      width: 390
    })

    const opener = page.getByRole('button', { name: 'Open locked bottom sheet' })

    await opener.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Locked bottom sheet' })

    await waitForDialogTransition(dialog)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.mouse.click(1, 1)
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Complete locked bottom sheet' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('should keep long content reachable as the mobile viewport shrinks', async ({ page }) => {
    await page.setViewportSize({
      height: 844,
      width: 390
    })

    const opener = page.getByRole('button', { name: 'Open long bottom sheet' })

    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'Long bottom sheet' })

    await waitForDialogTransition(dialog)

    const initialBox = await expectBottomAnchored(dialog, page)

    expect(initialBox.height).toBeLessThanOrEqual(844 * 0.9 + 1)

    await page.setViewportSize({
      height: 500,
      width: 390
    })

    await expect.poll(async () => {
      const box = await getElementBox(dialog)

      return Math.round(box.blockStart + box.height)
    }).toBe(500)

    const compactBox = await expectBottomAnchored(dialog, page)

    expect(compactBox.height).toBeLessThanOrEqual(500 * 0.9 + 1)

    const closeButton = dialog.getByRole('button', { name: 'Close long bottom sheet' })

    await closeButton.scrollIntoViewIfNeeded()
    await expect(closeButton).toBeVisible()
    await closeButton.click()
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('should remove dialog motion when reduced motion is preferred', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    await page.setViewportSize({
      height: 844,
      width: 390
    })

    await page.getByRole('button', { name: 'Open bottom sheet' }).click()

    const dialog = page.getByRole('dialog', { name: 'Bottom sheet' })

    await expect(dialog).toBeVisible()

    const motionStyles = await dialog.evaluate((element) => {
      const computedStyle = globalThis.getComputedStyle(element)

      const transitionDurations = computedStyle.transitionDuration
        .split(',')
        .map((duration) => duration.trim())

      return {
        closedTranslate: computedStyle.getPropertyValue('--dialog-closed-block-translate').trim(),
        transitionDurations
      }
    })

    expect(motionStyles.closedTranslate).toBe('0')
    expect(motionStyles.transitionDurations.every((duration) => duration === '0s')).toBe(true)

    await dialog.getByRole('button', { name: 'Close bottom sheet' }).click()

    await page.setViewportSize({
      height: 768,
      width: 1024
    })

    await page.getByRole('button', { name: 'Open side sheet' }).click()

    const sideSheet = page.getByRole('dialog', { name: 'Side sheet' })

    await expect(sideSheet).toBeVisible()

    const sideSheetMotionStyles = await sideSheet.evaluate((element) => {
      const computedStyle = globalThis.getComputedStyle(element)
      const transitionDurations = computedStyle.transitionDuration
        .split(',')
        .map((duration) => duration.trim())

      return {
        closedInlineTranslate: computedStyle.getPropertyValue('--dialog-closed-inline-translate').trim(),
        openInlineTranslate: computedStyle.getPropertyValue('--dialog-open-inline-translate').trim(),
        transitionDurations
      }
    })

    expect(sideSheetMotionStyles.closedInlineTranslate).toBe(sideSheetMotionStyles.openInlineTranslate)
    expect(sideSheetMotionStyles.transitionDurations.every((duration) => duration === '0s')).toBe(true)
  })
})
