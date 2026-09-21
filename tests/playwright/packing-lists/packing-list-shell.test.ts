import type { BrowserContext, Locator, Page, Request, Response, Route } from '@playwright/test'
import { mockAccountUser } from '../fixtures/account-user.fixtures.ts'
import { expect, test, waitForInitialEmailSignInTurnstile } from '../fixtures/global.fixtures.ts'

interface PackingListSummary {
  createdAt: string;
  entryCount: number;
  id: string;
  name: string;
  packedCount: number;
  updatedAt: string;
}

interface PackingListSummaryOptions {
  entryCount?: number;
  id?: string;
  packedCount?: number;
}

interface PackingListEntryInventory {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface PackingListEntryBase {
  createdAt: string;
  customName: string | null;
  id: string;
  isPacked: boolean;
  updatedAt: string;
}

interface PackingListCustomEntry extends PackingListEntryBase {
  source: 'custom';
}

interface PackingListInventoryEntry extends PackingListEntryBase {
  inventory: PackingListEntryInventory;
  source: 'inventory';
}

type PackingListEntry = PackingListCustomEntry | PackingListInventoryEntry

interface PackingListDetail {
  createdAt: string;
  entries: PackingListEntry[];
  id: string;
  name: string;
  updatedAt: string;
}

interface AvailableGearItem {
  brand: string;
  category: string;
  inventoryId: string;
  itemName: string;
}

interface AvailableGearResponse {
  items: AvailableGearItem[];
  nextPage: number | null;
}

interface AvailableGearRequest {
  page: number;
  search: string;
}

interface PackingListEntryMutationResponse {
  entry: PackingListEntry;
  packingListUpdatedAt: string;
}

interface EntryPatchReply {
  gate?: Promise<void>;
  status?: number;
  updateState?: boolean;
  updatedAt?: string;
}

interface EntryPatchRequest {
  body: unknown;
  entryId: string;
}

interface EntryPatchBody {
  isPacked: boolean;
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

interface PackingListRouteState {
  availableGearRequests: AvailableGearRequest[];
  availableGearResponses: Map<string, AvailableGearResponse[]>;
  createRequests: number;
  detail: PackingListDetail;
  detailRequests: number;
  entryCreateBodies: unknown[];
  entryCreateResponses: PackingListEntryMutationResponse[];
  entryDeleteRequests: number;
  entryPatchReplies: Map<string, EntryPatchReply[]>;
  entryPatchRequests: EntryPatchRequest[];
  getDelayMs: number;
  getGates: Promise<void>[];
  getRequests: number;
  rows: PackingListSummary[];
}

const packingListId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'
const pocketRocketInventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9'
const whisperLiteInventoryId = '0195f6e8-8f44-74f6-bc9a-5c8f7df477da'

const guestUser = {
  email: null,
  isAdmin: false,
  isGuest: true,
  isTwitchLinked: false,
  userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
} as const

function createPackingListSummary(name: string, options: PackingListSummaryOptions = {}): PackingListSummary {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    entryCount: options.entryCount ?? 0,
    id: options.id ?? packingListId,
    name,
    packedCount: options.packedCount ?? 0,
    updatedAt: '2026-04-03T09:00:00.000Z'
  }
}

function createPackingListDetail(name: string, entries: PackingListEntry[] = []): PackingListDetail {
  return {
    createdAt: '2026-04-03T09:00:00.000Z',
    entries,
    id: packingListId,
    name,
    updatedAt: '2026-04-03T09:00:00.000Z'
  }
}

function createPackingListEntries(): [PackingListCustomEntry, PackingListInventoryEntry] {
  return [{
    createdAt: '2026-04-03T09:01:00.000Z',
    customName: 'Rain jacket',
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e1',
    isPacked: false,
    source: 'custom',
    updatedAt: '2026-04-03T09:01:00.000Z'
  }, {
    createdAt: '2026-04-03T09:02:00.000Z',
    customName: null,
    id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',

    inventory: {
      brand: 'MSR',
      category: 'Stoves',
      inventoryId: pocketRocketInventoryId,
      itemName: 'PocketRocket Deluxe'
    },

    isPacked: true,
    source: 'inventory',
    updatedAt: '2026-04-03T09:02:00.000Z'
  }]
}

function createAvailableGearItem(inventoryId: string, itemName: string): AvailableGearItem {
  return {
    brand: 'MSR',
    category: 'Stoves',
    inventoryId,
    itemName
  }
}

function createInventoryEntryMutation(
  inventoryId: string,
  itemName: string,
  entryId: string
): PackingListEntryMutationResponse {
  return {
    entry: {
      createdAt: '2026-04-03T09:03:00.000Z',
      customName: null,
      id: entryId,

      inventory: {
        brand: 'MSR',
        category: 'Stoves',
        inventoryId,
        itemName
      },

      isPacked: false,
      source: 'inventory',
      updatedAt: '2026-04-03T09:03:00.000Z'
    },

    packingListUpdatedAt: '2026-04-03T09:03:00.000Z'
  }
}

function createCustomEntryMutation(customName: string): PackingListEntryMutationResponse {
  return {
    entry: {
      createdAt: '2026-04-03T09:04:00.000Z',
      customName,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e4',
      isPacked: false,
      source: 'custom',
      updatedAt: '2026-04-03T09:04:00.000Z'
    },

    packingListUpdatedAt: '2026-04-03T09:04:00.000Z'
  }
}

function createAvailableGearKey(search: string, page: number): string {
  return `${search}:${page}`
}

function createPackingListRouteState(rows: PackingListSummary[]): PackingListRouteState {
  const [firstRow = createPackingListSummary('Alpine weekend')] = rows
  const detailName = firstRow.name

  return {
    availableGearRequests: [],
    availableGearResponses: new Map(),
    createRequests: 0,
    detail: createPackingListDetail(detailName),
    detailRequests: 0,
    entryCreateBodies: [],
    entryCreateResponses: [],
    entryDeleteRequests: 0,
    entryPatchReplies: new Map(),
    entryPatchRequests: [],
    getDelayMs: 0,
    getGates: [],
    getRequests: 0,
    rows
  }
}

function syncPackingListSummary(state: PackingListRouteState): void {
  const entryCount = state.detail.entries.length
  const packedCount = state.detail.entries.filter((entry) => entry.isPacked).length

  state.rows = state.rows.map((row) => row.id === state.detail.id ? {
    ...row,
    entryCount,
    packedCount,
    updatedAt: state.detail.updatedAt
  } : row)
}

function isPackingListCreateResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isPackingListCollectionResponse = responseUrl.pathname === '/api/user/packing-lists'
  const isPostRequest = response.request().method() === 'POST'

  return isPackingListCollectionResponse && isPostRequest
}

function isPackingListCollectionGetRequest(request: Request): boolean {
  const responseUrl = new globalThis.URL(request.url())
  const isPackingListCollectionResponse = responseUrl.pathname === '/api/user/packing-lists'
  const isGetRequest = request.method() === 'GET'

  return isPackingListCollectionResponse && isGetRequest
}

function isPackingListCollectionGetResponse(response: Response): boolean {
  return isPackingListCollectionGetRequest(response.request())
}

function isPackingListEntryCreateRequest(request: Request): boolean {
  const requestUrl = new globalThis.URL(request.url())
  const isEntryCollectionRequest = requestUrl.pathname.endsWith('/entries')
  const isPostRequest = request.method() === 'POST'

  return isEntryCollectionRequest && isPostRequest
}

function isPackingListEntryDeleteResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isEntryDeletePath = responseUrl.pathname.includes(`/api/user/packing-lists/${packingListId}/entries/`)
  const isDeleteRequest = response.request().method() === 'DELETE'

  return isEntryDeletePath && isDeleteRequest
}

function isPackingListEntryPatchResponse(response: Response): boolean {
  const responseUrl = new globalThis.URL(response.url())
  const isEntryPatchPath = responseUrl.pathname.includes(`/api/user/packing-lists/${packingListId}/entries/`)
  const isPatchRequest = response.request().method() === 'PATCH'

  return isEntryPatchPath && isPatchRequest
}

function isEntryPatchBody(value: unknown): value is EntryPatchBody {
  if (typeof value !== 'object' || value === null || !('isPacked' in value)) {
    return false
  }

  return typeof value.isPacked === 'boolean'
}

async function fulfillPackingListCollectionRoute(route: Route, page: Page, state: PackingListRouteState): Promise<void> {
  const request = route.request()
  const method = request.method()

  if (method === 'GET') {
    state.getRequests += 1

    const responseRows = state.rows.map((row) => {
      return { ...row }
    })

    const getGate = state.getGates.shift()

    if (state.getDelayMs > 0) {
      await page.waitForTimeout(state.getDelayMs)
    }

    if (getGate !== undefined) {
      await getGate
    }

    if (request.failure() !== null) {
      return
    }

    await route.fulfill({
      json: responseRows
    })

    return
  }

  if (method === 'POST') {
    state.createRequests += 1

    expect(request.postDataJSON()).toStrictEqual({
      name: 'Alpine weekend'
    })

    await page.waitForTimeout(250)

    const createdList = createPackingListSummary('Alpine weekend')

    state.detail = createPackingListDetail(createdList.name)
    state.rows = [createdList]

    await route.fulfill({
      status: 201,

      json: {
        createdAt: createdList.createdAt,
        id: createdList.id,
        name: createdList.name,
        updatedAt: createdList.updatedAt
      }
    })

    return
  }

  await route.abort()
}

async function fulfillAvailableGearRoute(route: Route, requestUrl: URL, state: PackingListRouteState): Promise<void> {
  const page = Number(requestUrl.searchParams.get('page') ?? '1')
  const search = requestUrl.searchParams.get('search') ?? ''
  const responseKey = createAvailableGearKey(search, page)
  const configuredResponses = state.availableGearResponses.get(responseKey) ?? []

  const response = configuredResponses.length > 1
    ? configuredResponses.shift()
    : configuredResponses[0]

  state.availableGearRequests.push({
    page,
    search
  })

  await route.fulfill({
    json: response ?? {
      items: [],
      nextPage: null
    }
  })
}

async function fulfillEntryCreateRoute(route: Route, state: PackingListRouteState): Promise<void> {
  const body: unknown = route.request().postDataJSON()
  const response = state.entryCreateResponses.shift()

  state.entryCreateBodies.push(body)

  if (response === undefined) {
    await route.fulfill({
      status: 500,

      json: {
        message: 'No entry response configured'
      }
    })

    return
  }

  state.detail = {
    ...state.detail,

    entries: [
      ...state.detail.entries,
      response.entry
    ],

    updatedAt: response.packingListUpdatedAt
  }

  syncPackingListSummary(state)

  await route.fulfill({
    status: 201,
    json: response
  })
}

async function fulfillEntryDeleteRoute(route: Route, state: PackingListRouteState): Promise<void> {
  const requestUrl = new globalThis.URL(route.request().url())
  const entryId = requestUrl.pathname.split('/').at(-1) ?? ''
  const entryExists = state.detail.entries.some((entry) => entry.id === entryId)

  state.entryDeleteRequests += 1

  if (entryExists === false) {
    await route.fulfill({
      status: 404,

      json: {
        statusCode: 404
      }
    })

    return
  }

  state.detail = {
    createdAt: state.detail.createdAt,
    entries: state.detail.entries.filter((entry) => entry.id !== entryId),
    id: state.detail.id,
    name: state.detail.name,
    updatedAt: '2026-04-03T09:06:00.000Z'
  }

  syncPackingListSummary(state)

  await route.fulfill({
    status: 200,

    json: {
      deletedEntryId: entryId,
      packingListUpdatedAt: state.detail.updatedAt
    }
  })
}

async function fulfillEntryPatchRoute(route: Route, state: PackingListRouteState): Promise<void> {
  const requestUrl = new globalThis.URL(route.request().url())
  const entryId = requestUrl.pathname.split('/').at(-1) ?? ''
  const body: unknown = route.request().postDataJSON()
  const reply = state.entryPatchReplies.get(entryId)?.shift()
  const entry = state.detail.entries.find((current) => current.id === entryId)

  state.entryPatchRequests.push({
    body,
    entryId
  })

  if (reply?.gate !== undefined) {
    await reply.gate
  }

  if (reply?.status !== undefined && reply.status !== 200) {
    await route.fulfill({
      status: reply.status,
      json: { message: 'Internal error details must stay hidden' }
    })

    return
  }

  if (entry === undefined || !isEntryPatchBody(body)) {
    await route.fulfill({
      status: 400,
      json: { statusCode: 400 }
    })

    return
  }

  const updatedAt = reply?.updatedAt ?? '2026-04-03T09:07:00.000Z'

  const updatedEntry = {
    ...entry,
    isPacked: body.isPacked,
    updatedAt
  }

  if (reply?.updateState !== false) {
    state.detail = {
      ...state.detail,
      entries: state.detail.entries.map((current) => current.id === entryId ? updatedEntry : current),
      updatedAt: Date.parse(updatedAt) > Date.parse(state.detail.updatedAt) ? updatedAt : state.detail.updatedAt
    }

    syncPackingListSummary(state)
  }

  await route.fulfill({
    json: {
      entry: updatedEntry,
      packingListUpdatedAt: updatedAt
    }
  })
}

async function mockPackingListRoutes(context: BrowserContext, page: Page, state: PackingListRouteState): Promise<void> {
  await context.route('**/api/user/packing-lists**', async (route) => {
    const requestUrl = new globalThis.URL(route.request().url())
    const requestMethod = route.request().method()
    const detailPath = `/api/user/packing-lists/${packingListId}`

    if (requestUrl.pathname === '/api/user/packing-lists') {
      await fulfillPackingListCollectionRoute(route, page, state)

      return
    }

    if (requestUrl.pathname === `${detailPath}/available-gear` && requestMethod === 'GET') {
      await fulfillAvailableGearRoute(route, requestUrl, state)

      return
    }

    if (requestUrl.pathname === `${detailPath}/entries` && requestMethod === 'POST') {
      await fulfillEntryCreateRoute(route, state)

      return
    }

    if (requestUrl.pathname.startsWith(`${detailPath}/entries/`) && requestMethod === 'DELETE') {
      await fulfillEntryDeleteRoute(route, state)

      return
    }

    if (requestUrl.pathname.startsWith(`${detailPath}/entries/`) && requestMethod === 'PATCH') {
      await fulfillEntryPatchRoute(route, state)

      return
    }

    if (requestUrl.pathname !== detailPath || requestMethod !== 'GET') {
      await route.abort()

      return
    }

    state.detailRequests += 1

    await route.fulfill({
      json: state.detail
    })
  })
}

async function mockAuth(context: BrowserContext): Promise<void> {
  await context.route('**/api/auth/create-session**', async (route) => {
    await route.fulfill({
      status: 201,

      json: {
        isGuest: true,
        userId: '0195f6e8-8f44-74f6-bc9a-5c8f7df477aa'
      }
    })
  })
}

async function mockLogout(context: BrowserContext): Promise<void> {
  await context.route('**/api/auth/logout**', async (route) => {
    await route.fulfill({
      status: 204,
      body: ''
    })
  })
}

async function openPackingLists(page: Page): Promise<void> {
  await page.goto('/login?redirectTo=/')
  await waitForInitialEmailSignInTurnstile(page)
  await page.getByRole('button', { name: 'Guest' }).click()

  const sidebar = page.getByTestId('shell-sidebar')

  await sidebar.getByRole('link', { name: 'Packing lists' }).click()
}

function throwUnresolvedDeferred(): never {
  throw new Error('Deferred resolver was not initialized')
}

function createDeferred(): Deferred {
  let resolveDeferred: () => void = throwUnresolvedDeferred

  // oxlint-disable-next-line promise/avoid-new -- The test needs a manually released response.
  const promise = new Promise<void>((resolve) => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve: resolveDeferred
  }
}

async function getElementBox(locator: Locator) {
  const box = await locator.boundingBox()

  if (box === null) {
    throw new Error('Expected element to have a bounding box')
  }

  return box
}

function getPackingProgress(page: Page, text: string) {
  return page.getByRole('status').filter({ hasText: text })
}

test.describe('Packing list shell', () => {
  test('should create a list and stay on the packing lists page', async ({ context, page }) => {
    const state = createPackingListRouteState([])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await expect(page).toHaveURL(/\/packing-lists$/u)

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Packing lists',
      exact: true
    })).toBeVisible()

    await expect(page.getByRole('heading', { name: 'No packing lists yet.' })).toBeVisible()
    await page.getByRole('button', { name: 'New list' }).first().click()
    await expect(page.getByRole('heading', { name: 'Create a packing list' })).toBeVisible()
    await page.getByLabel('List name').fill('Alpine weekend')

    const createResponsePromise = page.waitForResponse(isPackingListCreateResponse)

    await page.getByRole('button', { name: 'Create list' }).click()

    const createResponse = await createResponsePromise

    expect(createResponse.status()).toBe(201)
    expect(state.createRequests).toBe(1)
    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(page.getByRole('heading', { name: 'Create a packing list' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Alpine weekend/iu })).toBeVisible()
    expect(state.detailRequests).toBe(0)
  })

  test('should keep the create dialog centered on mobile and restore focus', async ({ context, page }) => {
    const state = createPackingListRouteState([])

    await page.setViewportSize({
      height: 844,
      width: 390
    })

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await page.goto('/login?redirectTo=/packing-lists')
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(/\/packing-lists$/u)

    const opener = page.getByRole('button', { name: 'New list' }).first()

    await opener.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Create a packing list' })

    await expect(dialog).toBeVisible()

    await expect.poll(
      async () => dialog.evaluate((element) => globalThis.getComputedStyle(element).opacity)
    ).toBe('1')

    const box = await getElementBox(dialog)
    const inlineCenter = box.x + box.width / 2
    const blockCenter = box.y + box.height / 2
    const inlineOffset = Math.abs(inlineCenter - 390 / 2)
    const blockOffset = Math.abs(blockCenter - 844 / 2)

    expect(box.width).toBeLessThan(390)
    expect(inlineOffset).toBeLessThan(2)
    expect(blockOffset).toBeLessThan(2)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
  })

  test('should show empty, partial, and complete progress on narrow overview cards', async ({ context, page }) => {
    const state = createPackingListRouteState([
      createPackingListSummary('Empty trail'),

      createPackingListSummary('A very long weekend packing list for a windy coastal trail', {
        entryCount: 3,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d8',
        packedCount: 1
      }),

      createPackingListSummary('Ready trail', {
        entryCount: 2,
        id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477d9',
        packedCount: 2
      })
    ])

    await page.setViewportSize({
      height: 844,
      width: 390
    })

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await page.goto('/login?redirectTo=/packing-lists')
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(getPackingProgress(page, '0 items')).toHaveText('0 items')
    await expect(getPackingProgress(page, '1 of 3 packed')).toHaveText('1 of 3 packed')
    await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')

    const hasHorizontalOverflow = await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth > globalThis.document.documentElement.clientWidth
    )

    expect(hasHorizontalOverflow).toBe(false)
  })

  test('should route from a list card to the item list page', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])

    state.detail = createPackingListDetail('Alpine weekend', createPackingListEntries())

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Alpine weekend'
    })).toBeVisible()

    await expect(page.getByText('Rain jacket')).toBeVisible()
    await expect(page.getByText('PocketRocket Deluxe')).toBeVisible()
    await expect(page.getByText('MSR / Stoves')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove Rain jacket' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remove PocketRocket Deluxe' })).toBeVisible()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(1)
  })

  test('should seed optimistic summary state without marking the overview loaded', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Direct trail', {
      entryCount: 2,
      packedCount: 1
    })])

    const [customEntry, inventoryEntry] = createPackingListEntries()
    const patchGate = createDeferred()
    const collectionGate = createDeferred()

    state.detail = createPackingListDetail('Direct trail', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{ gate: patchGate.promise }])
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await page.goto(`/login?redirectTo=/packing-lists/${packingListId}`)
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByRole('button', { name: 'Guest' }).click()
    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    expect(state.getRequests).toBe(0)

    const patchResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)
    const collectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)

    try {
      await page.getByRole('checkbox', { name: 'Rain jacket' }).click()
      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      state.getGates.push(collectionGate.promise)
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect(page.getByRole('heading', { name: 'Loading packing lists' })).toBeVisible()
      await expect(page.getByRole('link', { name: /Direct trail/iu })).toHaveCount(0)
      await expect.poll(() => state.getRequests).toBe(1)
      collectionGate.resolve()

      await collectionResponsePromise

      await expect(page.getByRole('link', { name: /Direct trail/iu })).toBeVisible()
      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
      patchGate.resolve()

      await patchResponsePromise

      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
    } finally {
      patchGate.resolve()
      collectionGate.resolve()
    }
  })

  test('should pack and unpack both entry types with pointer and keyboard, then restore them from server data', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const [customEntry, inventoryEntry] = createPackingListEntries()

    state.detail = createPackingListDetail('Alpine weekend', [customEntry, inventoryEntry])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    const customCheckbox = page.getByRole('checkbox', { name: 'Rain jacket' })
    const inventoryCheckbox = page.getByRole('checkbox', { name: /PocketRocket Deluxe/u })

    await expect(customCheckbox).not.toBeChecked()
    await expect(inventoryCheckbox).toBeChecked()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')

    const packResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

    await customCheckbox.click()

    const packResponse = await packResponsePromise

    expect(packResponse.status()).toBe(200)
    expect(packResponse.request().postDataJSON()).toStrictEqual({ isPacked: true })
    await expect(customCheckbox).toBeChecked()
    await expect(customCheckbox).toBeEnabled()
    await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')

    const unpackResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

    await inventoryCheckbox.focus()
    await page.keyboard.press('Space')

    const unpackResponse = await unpackResponsePromise

    expect(unpackResponse.status()).toBe(200)
    expect(unpackResponse.request().postDataJSON()).toStrictEqual({ isPacked: false })
    await expect(inventoryCheckbox).not.toBeChecked()
    await expect(inventoryCheckbox).toBeEnabled()
    await expect(inventoryCheckbox).toBeFocused()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    await page.reload()

    // The Guest endpoint is mocked, so a full reload needs the same mocked sign-in again.
    await waitForInitialEmailSignInTurnstile(page)
    await page.getByRole('button', { name: /Continue as guest/iu }).click()
    await expect(page.getByRole('checkbox', { name: 'Rain jacket' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /PocketRocket Deluxe/u })).not.toBeChecked()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await expect(page.getByRole('checkbox', { name: 'Rain jacket' })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /PocketRocket Deluxe/u })).not.toBeChecked()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')

    expect(state.entryPatchRequests).toStrictEqual([{
      body: { isPacked: true },
      entryId: customEntry.id
    }, {
      body: { isPacked: false },
      entryId: inventoryEntry.id
    }])
  })

  test('should keep optimistic progress when returning before stale requests finish', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Fast trail', {
      entryCount: 2,
      packedCount: 1
    })])

    const [customEntry, inventoryEntry] = createPackingListEntries()
    const patchGate = createDeferred()
    const collectionGate = createDeferred()

    state.detail = createPackingListDetail('Fast trail', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{ gate: patchGate.promise }])
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Fast trail/iu }).click()

    const checkbox = page.getByRole('checkbox', { name: 'Rain jacket' })

    try {
      await checkbox.click()
      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      state.getGates.push(collectionGate.promise)

      const collectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)
      const patchResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect(page).toHaveURL(/\/packing-lists$/u)
      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
      await expect.poll(() => state.getRequests).toBe(2)
      patchGate.resolve()

      await patchResponsePromise

      collectionGate.resolve()

      await collectionResponsePromise

      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Home' }).click()
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
    } finally {
      patchGate.resolve()
      collectionGate.resolve()
    }
  })

  test('should keep a pending entry locked after leaving and reopening its detail page', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Remount trail', {
      entryCount: 2,
      packedCount: 1
    })])

    const [customEntry, inventoryEntry] = createPackingListEntries()
    const patchGate = createDeferred()
    const collectionGate = createDeferred()

    state.detail = createPackingListDetail('Remount trail', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{ gate: patchGate.promise }])
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Remount trail/iu }).click()

    try {
      await page.getByRole('checkbox', { name: 'Rain jacket' }).click()
      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      state.getGates.push(collectionGate.promise)
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(2)
      await page.getByRole('link', { name: /Remount trail/iu }).click()

      const remountedCheckbox = page.getByRole('checkbox', { name: 'Rain jacket' })

      await expect(remountedCheckbox).toBeChecked()
      await expect(remountedCheckbox).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Remove Rain jacket' })).toBeDisabled()
      expect(state.entryPatchRequests).toHaveLength(1)
      patchGate.resolve()
      await expect(remountedCheckbox).toBeEnabled()
      await expect(remountedCheckbox).toBeChecked()
      expect(state.entryPatchRequests).toHaveLength(1)
      collectionGate.resolve()
    } finally {
      patchGate.resolve()
      collectionGate.resolve()
    }
  })

  test('should roll overview progress back when a pending pack request fails after navigation', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Retry trail', {
      entryCount: 2,
      packedCount: 1
    })])

    const [customEntry, inventoryEntry] = createPackingListEntries()
    const patchGate = createDeferred()
    const collectionGate = createDeferred()

    state.detail = createPackingListDetail('Retry trail', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{
      gate: patchGate.promise,
      status: 500
    }])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Retry trail/iu }).click()

    try {
      await page.getByRole('checkbox', { name: 'Rain jacket' }).click()
      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      state.getGates.push(collectionGate.promise)

      const patchResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)
      const collectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)

      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect(getPackingProgress(page, '2 of 2 packed · All packed')).toHaveText('2 of 2 packed · All packed')
      await expect.poll(() => state.getRequests).toBe(2)
      patchGate.resolve()

      const patchResponse = await patchResponsePromise

      expect(patchResponse.status()).toBe(500)
      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
      collectionGate.resolve()

      await collectionResponsePromise

      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    } finally {
      patchGate.resolve()
      collectionGate.resolve()
    }
  })

  test('should keep other entries usable and merge responses that finish in reverse order', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const [customEntry, inventoryEntry] = createPackingListEntries()
    const firstGate = createDeferred()
    const secondGate = createDeferred()
    const collectionGate = createDeferred()

    state.detail = createPackingListDetail('Alpine weekend', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{
      gate: firstGate.promise,
      updatedAt: '2026-04-03T09:08:00.000Z'
    }])

    state.entryPatchReplies.set(inventoryEntry.id, [{
      gate: secondGate.promise,
      updatedAt: '2026-04-03T09:09:00.000Z'
    }])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    const customCheckbox = page.getByRole('checkbox', { name: 'Rain jacket' })
    const inventoryCheckbox = page.getByRole('checkbox', { name: /PocketRocket Deluxe/u })
    const customCard = page.getByRole('listitem').filter({ has: customCheckbox })
    const inventoryCard = page.getByRole('listitem').filter({ has: inventoryCheckbox })

    try {
      await customCheckbox.click()
      await expect(customCheckbox).toBeChecked()
      await expect(customCheckbox).toBeDisabled()
      await expect(customCard.getByText('Saving Rain jacket…', { exact: true })).toBeVisible()
      await expect(customCard.getByRole('status')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Remove Rain jacket' })).toBeDisabled()
      await expect(inventoryCheckbox).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Remove PocketRocket Deluxe' })).toBeEnabled()

      const disabledLabelBox = await getElementBox(page.getByText('Rain jacket', { exact: true }))

      await page.mouse.click(
        disabledLabelBox.x + disabledLabelBox.width / 2,
        disabledLabelBox.y + disabledLabelBox.height / 2
      )

      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      await inventoryCheckbox.click()
      await expect(inventoryCheckbox).not.toBeChecked()
      await expect(inventoryCheckbox).toBeDisabled()
      await expect(inventoryCard.getByText('Saving PocketRocket Deluxe…', { exact: true })).toBeVisible()
      await expect(inventoryCard.getByRole('status')).toHaveCount(0)

      await expect.poll(() => state.entryPatchRequests).toStrictEqual([{
        body: { isPacked: true },
        entryId: customEntry.id
      }, {
        body: { isPacked: false },
        entryId: inventoryEntry.id
      }])

      state.getGates.push(collectionGate.promise)

      const collectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)

      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(2)
      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')

      const secondResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

      secondGate.resolve()

      await secondResponsePromise

      collectionGate.resolve()

      await collectionResponsePromise

      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')

      const firstResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

      firstGate.resolve()

      await firstResponsePromise

      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    } finally {
      firstGate.resolve()
      secondGate.resolve()
      collectionGate.resolve()
    }
  })

  test('should show keyboard focus on a pack checkbox in forced colors', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const [customEntry] = createPackingListEntries()

    state.detail = createPackingListDetail('Alpine weekend', [customEntry])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await page.emulateMedia({ forcedColors: 'active' })

    const checkbox = page.getByRole('checkbox', { name: 'Rain jacket' })

    await checkbox.focus()
    await expect(checkbox).toHaveCSS('outline-style', 'solid')
    await expect(checkbox).toHaveCSS('outline-width', '2px')
  })

  test('should restore focus to the latest changed entry when the first patch finishes first', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const [customEntry, inventoryEntry] = createPackingListEntries()
    const firstGate = createDeferred()
    const secondGate = createDeferred()

    state.detail = createPackingListDetail('Alpine weekend', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{ gate: firstGate.promise }])
    state.entryPatchReplies.set(inventoryEntry.id, [{ gate: secondGate.promise }])
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    const customCheckbox = page.getByRole('checkbox', { name: 'Rain jacket' })
    const inventoryCheckbox = page.getByRole('checkbox', { name: /PocketRocket Deluxe/u })

    try {
      await customCheckbox.click()
      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      await inventoryCheckbox.click()
      await expect.poll(() => state.entryPatchRequests.length).toBe(2)
      firstGate.resolve()
      await expect(customCheckbox).toBeEnabled()
      await expect(inventoryCheckbox).toBeDisabled()
      secondGate.resolve()
      await expect(inventoryCheckbox).toBeEnabled()
      await expect(inventoryCheckbox).toBeFocused()
    } finally {
      firstGate.resolve()
      secondGate.resolve()
    }
  })

  test('should restore a failed pack change and let that entry retry', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const [customEntry, inventoryEntry] = createPackingListEntries()

    state.detail = createPackingListDetail('Alpine weekend', [customEntry, inventoryEntry])

    state.entryPatchReplies.set(customEntry.id, [{ status: 500 }, {}])
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()

    const customCheckbox = page.getByRole('checkbox', { name: 'Rain jacket' })
    const inventoryCheckbox = page.getByRole('checkbox', { name: /PocketRocket Deluxe/u })
    const customCard = page.getByRole('listitem').filter({ has: customCheckbox })
    const failureResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

    await customCheckbox.click()

    const failureResponse = await failureResponsePromise

    expect(failureResponse.status()).toBe(500)
    await expect(customCheckbox).not.toBeChecked()
    await expect(customCheckbox).toBeEnabled()
    await expect(customCard.getByRole('alert')).toHaveText('Could not update Rain jacket. Try again.')
    await expect(customCheckbox).toHaveAttribute('aria-describedby', /.+/u)
    await expect(inventoryCheckbox).toBeChecked()

    const retryResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

    await customCheckbox.click()

    const retryResponse = await retryResponsePromise

    expect(retryResponse.status()).toBe(200)
    await expect(customCheckbox).toBeChecked()
    await expect(customCard.getByRole('alert')).toHaveCount(0)
    await expect(inventoryCheckbox).toBeChecked()

    expect(state.entryPatchRequests).toStrictEqual([{
      body: { isPacked: true },
      entryId: customEntry.id
    }, {
      body: { isPacked: true },
      entryId: customEntry.id
    }])
  })

  test('should refresh the open item composer after removing an inventory item', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Weekend trail')])
    const availablePocketRocket = createAvailableGearItem(pocketRocketInventoryId, 'PocketRocket Deluxe')

    const existingEntry: PackingListInventoryEntry = {
      createdAt: '2026-04-03T09:02:00.000Z',
      customName: null,
      id: '0195f6e8-8f44-74f6-bc9a-5c8f7df477e2',

      inventory: {
        brand: 'MSR',
        category: 'Stoves',
        inventoryId: pocketRocketInventoryId,
        itemName: 'PocketRocket Deluxe'
      },

      isPacked: true,
      source: 'inventory',
      updatedAt: '2026-04-03T09:02:00.000Z'
    }

    const firstPageKey = createAvailableGearKey('', 1)

    state.detail = createPackingListDetail('Weekend trail', [existingEntry])

    state.availableGearResponses.set(firstPageKey, [{
      items: [],
      nextPage: null
    }, {
      items: [availablePocketRocket],
      nextPage: null
    }])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Weekend trail/iu }).click()
    await expect(getPackingProgress(page, '1 of 1 packed · All packed')).toHaveText('1 of 1 packed · All packed')
    await page.getByText('Add item', { exact: true }).click()
    await expect(page.getByText('No available My gear items. Type a name to add a custom item.')).toBeVisible()

    const deleteResponsePromise = page.waitForResponse(isPackingListEntryDeleteResponse)

    await page.getByRole('button', { name: 'Remove PocketRocket Deluxe' }).click()

    const deleteResponse = await deleteResponsePromise
    const deleteResponseUrl = new globalThis.URL(deleteResponse.url())

    expect(deleteResponse.status()).toBe(200)
    expect(deleteResponseUrl.pathname).toBe(`/api/user/packing-lists/${packingListId}/entries/${existingEntry.id}`)
    expect(state.entryDeleteRequests).toBe(1)
    await expect(page.getByRole('button', { name: 'Remove PocketRocket Deluxe' })).toHaveCount(0)
    await expect(getPackingProgress(page, 'packed')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^PocketRocket Deluxe MSR · Stoves Add$/u })).toBeVisible()

    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }, {
      page: 1,
      search: ''
    }])
  })

  test('should keep packed counts correct while removing unpacked and packed entries', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Removal trail', {
      entryCount: 2,
      packedCount: 1
    })])

    const [customEntry, inventoryEntry] = createPackingListEntries()
    const firstCollectionGate = createDeferred()
    const secondCollectionGate = createDeferred()

    state.detail = createPackingListDetail('Removal trail', [customEntry, inventoryEntry])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Removal trail/iu }).click()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')

    try {
      const unpackedDeleteResponsePromise = page.waitForResponse(isPackingListEntryDeleteResponse)

      await page.getByRole('button', { name: 'Remove Rain jacket' }).click()

      await unpackedDeleteResponsePromise

      await expect(getPackingProgress(page, '1 of 1 packed · All packed')).toHaveText('1 of 1 packed · All packed')
      state.getGates.push(firstCollectionGate.promise)

      const firstCollectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)

      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(2)
      await expect(getPackingProgress(page, '1 of 1 packed · All packed')).toHaveText('1 of 1 packed · All packed')
      firstCollectionGate.resolve()

      await firstCollectionResponsePromise

      await page.getByRole('link', { name: /Removal trail/iu }).click()

      const packedDeleteResponsePromise = page.waitForResponse(isPackingListEntryDeleteResponse)

      await page.getByRole('button', { name: 'Remove PocketRocket Deluxe' }).click()

      await packedDeleteResponsePromise

      await expect(getPackingProgress(page, '0 items')).toHaveText('0 items')
      state.getGates.push(secondCollectionGate.promise)

      const secondCollectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)

      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(3)
      await expect(getPackingProgress(page, '0 items')).toHaveText('0 items')
      secondCollectionGate.resolve()

      await secondCollectionResponsePromise

      await expect(getPackingProgress(page, '0 items')).toHaveText('0 items')
      expect(state.entryDeleteRequests).toBe(2)
    } finally {
      firstCollectionGate.resolve()
      secondCollectionGate.resolve()
    }
  })

  test('should close the item composer with Escape and restore focus', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Keyboard trail')])

    state.detail = createPackingListDetail('Keyboard trail', createPackingListEntries().slice(0, 1))

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Keyboard trail/iu }).click()

    const composerSummary = page.locator('summary').filter({ hasText: 'Add item' })
    const searchInput = page.getByLabel('Find an item')

    await composerSummary.click()
    await expect(searchInput).toBeFocused()
    await searchInput.fill('Rain')
    await searchInput.press('Escape')
    await expect(searchInput).toBeHidden()
    await expect(composerSummary).toBeFocused()
    await expect(page.getByText('Add item', { exact: true })).toBeVisible()
  })

  test('should lazily load My gear, load another page, and add an inventory item', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const pocketRocket = createAvailableGearItem(pocketRocketInventoryId, 'PocketRocket Deluxe')
    const whisperLite = createAvailableGearItem(whisperLiteInventoryId, 'WhisperLite Universal')
    const firstPageKey = createAvailableGearKey('', 1)
    const secondPageKey = createAvailableGearKey('', 2)
    const [customEntry] = createPackingListEntries()
    const collectionGate = createDeferred()

    state.detail = createPackingListDetail('Alpine weekend', [{
      ...customEntry,
      isPacked: true
    }])

    state.availableGearResponses.set(firstPageKey, [{
      items: [pocketRocket],
      nextPage: 2
    }, {
      items: [],
      nextPage: null
    }])

    state.availableGearResponses.set(secondPageKey, [{
      items: [whisperLite],
      nextPage: null
    }])

    state.entryCreateResponses.push(createInventoryEntryMutation(
      whisperLiteInventoryId,
      'WhisperLite Universal',
      '0195f6e8-8f44-74f6-bc9a-5c8f7df477e3'
    ))

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await expect(getPackingProgress(page, '1 of 1 packed · All packed')).toHaveText('1 of 1 packed · All packed')
    await expect(page.getByText('Add item', { exact: true })).toBeVisible()
    expect(state.availableGearRequests).toHaveLength(0)
    await page.getByText('Add item', { exact: true }).click()
    await expect(page.getByRole('button', { name: /PocketRocket Deluxe/iu })).toBeVisible()

    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }])

    await page.getByRole('button', { name: 'Load more' }).click()
    await expect(page.getByRole('button', { name: /WhisperLite Universal/iu })).toBeVisible()

    const createRequestPromise = page.waitForRequest(isPackingListEntryCreateRequest)

    await page.getByRole('button', { name: /WhisperLite Universal/iu }).click()

    await createRequestPromise

    await expect(page.getByText('WhisperLite Universal', { exact: true }).first()).toBeVisible()
    await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    await expect(page.getByText('All packed', { exact: true })).toHaveCount(0)
    await expect(page.getByText('WhisperLite Universal added.', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Find an item')).toBeFocused()

    expect(state.entryCreateBodies).toStrictEqual([{
      inventoryId: whisperLiteInventoryId
    }])

    state.getGates.push(collectionGate.promise)

    const collectionResponsePromise = page.waitForResponse(isPackingListCollectionGetResponse)

    try {
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(2)
      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
      collectionGate.resolve()

      await collectionResponsePromise

      await expect(getPackingProgress(page, '1 of 2 packed')).toHaveText('1 of 2 packed')
    } finally {
      collectionGate.resolve()
    }

    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }, {
      page: 2,
      search: ''
    }, {
      page: 1,
      search: ''
    }])
  })

  test('should debounce search and add the query as a custom item', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Alpine weekend')])
    const customName = 'Emergency blanket'

    const emptyPage = {
      items: [],
      nextPage: null
    }

    state.detail = createPackingListDetail('Alpine weekend', createPackingListEntries().slice(0, 1))

    state.availableGearResponses.set(createAvailableGearKey('', 1), [emptyPage])
    state.availableGearResponses.set(createAvailableGearKey(customName, 1), [emptyPage])
    state.entryCreateResponses.push(createCustomEntryMutation(customName))
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Alpine weekend/iu }).click()
    await page.getByText('Add item', { exact: true }).click()

    const searchInput = page.getByLabel('Find an item')

    await searchInput.fill('Emergency')
    await searchInput.fill(customName)
    await expect(page.getByRole('button', { name: `Add "${customName}" as custom item` })).toBeVisible()

    const latestAvailableGearRequest = state.availableGearRequests.at(-1)

    expect(latestAvailableGearRequest).toStrictEqual({
      page: 1,
      search: customName
    })

    await page.getByRole('button', { name: `Add "${customName}" as custom item` }).click()
    await expect(page.getByText(customName, { exact: true }).first()).toBeVisible()
    await expect(page.getByText(`${customName} added.`, { exact: true })).toHaveCount(0)
    await expect(searchInput).toBeFocused()
    await expect(searchInput).toHaveValue('')

    expect(state.entryCreateBodies).toStrictEqual([{
      customName
    }])
  })

  test('should keep one progress status while adding the first item to an empty list', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Empty trail')])
    const customName = 'Emergency blanket'

    state.detail = createPackingListDetail('Empty trail')

    state.entryCreateResponses.push(createCustomEntryMutation(customName))
    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Empty trail/iu }).click()
    await expect(page).toHaveURL(new RegExp(`/packing-lists/${packingListId}$`, 'u'))

    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Empty trail'
    })).toBeVisible()

    await expect(page.getByText('Add another item', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Find an item')).toBeVisible()
    await expect(getPackingProgress(page, '0 items')).toHaveText('0 items')
    await expect(page.getByRole('status')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Planning' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Checklist' })).toHaveCount(0)
    expect(state.detailRequests).toBe(1)

    expect(state.availableGearRequests).toStrictEqual([{
      page: 1,
      search: ''
    }])

    await page.getByLabel('Find an item').fill(customName)
    await page.getByRole('button', { name: `Add "${customName}" as custom item` }).click()
    await expect(getPackingProgress(page, '0 of 1 packed')).toHaveText('0 of 1 packed')
    await expect(page.getByRole('status')).toHaveCount(1)
  })

  test('should abort a stale collection request and keep reset state after logout', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Old session trail')])
    const staleCollectionGate = createDeferred()
    const freshCollectionGate = createDeferred()

    await mockAuth(context)
    await mockAccountUser(context, guestUser)
    await mockLogout(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await expect(page.getByRole('link', { name: /Old session trail/iu })).toBeVisible()

    try {
      state.getGates.push(staleCollectionGate.promise)

      const failedRequestPromise = page.waitForEvent('requestfailed', isPackingListCollectionGetRequest)
      const sidebar = page.getByTestId('shell-sidebar')

      await sidebar.getByRole('link', { name: 'Home' }).click()
      await sidebar.getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(2)
      await sidebar.getByRole('link', { name: 'Profile' }).click()
      await page.getByRole('button', { name: 'Log out' }).click()

      const failedRequest = await failedRequestPromise

      expect(failedRequest.failure()?.errorText).toMatch(/ERR_ABORTED/u)
      staleCollectionGate.resolve()
      await expect(page).toHaveURL(/\/login$/u)

      state.rows = [createPackingListSummary('New session trail')]
      state.detail = createPackingListDetail('New session trail')

      state.getGates.push(freshCollectionGate.promise)
      await page.getByRole('button', { name: 'Guest' }).click()
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect.poll(() => state.getRequests).toBe(3)
      await expect(page.getByRole('heading', { name: 'Loading packing lists' })).toBeVisible()
      await expect(page.getByRole('link', { name: /Old session trail/iu })).toHaveCount(0)
      freshCollectionGate.resolve()
      await expect(page.getByRole('link', { name: /New session trail/iu })).toBeVisible()
    } finally {
      staleCollectionGate.resolve()
      freshCollectionGate.resolve()
    }
  })

  test('should ignore a failed entry mutation that finishes after logout reset', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Old mutation trail', {
      entryCount: 1
    })])

    const [customEntry] = createPackingListEntries()
    const patchGate = createDeferred()

    state.detail = createPackingListDetail('Old mutation trail', [customEntry])

    state.entryPatchReplies.set(customEntry.id, [{
      gate: patchGate.promise,
      status: 500,
      updateState: false
    }])

    await mockAuth(context)
    await mockAccountUser(context, guestUser)
    await mockLogout(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)
    await page.getByRole('link', { name: /Old mutation trail/iu }).click()

    const patchResponsePromise = page.waitForResponse(isPackingListEntryPatchResponse)

    try {
      await page.getByRole('checkbox', { name: 'Rain jacket' }).click()
      await expect.poll(() => state.entryPatchRequests.length).toBe(1)
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Profile' }).click()
      await page.getByRole('button', { name: 'Log out' }).click()
      await expect(page).toHaveURL(/\/login$/u)

      state.rows = [createPackingListSummary('New mutation trail', {
        entryCount: 1
      })]

      state.detail = createPackingListDetail('New mutation trail', [customEntry])

      await page.getByRole('button', { name: 'Guest' }).click()
      await page.getByTestId('shell-sidebar').getByRole('link', { name: 'Packing lists' }).click()
      await expect(getPackingProgress(page, '0 of 1 packed')).toHaveText('0 of 1 packed')
      patchGate.resolve()

      const patchResponse = await patchResponsePromise

      expect(patchResponse.status()).toBe(500)
      await expect(getPackingProgress(page, '0 of 1 packed')).toHaveText('0 of 1 packed')
      await expect(getPackingProgress(page, '-1 of 1 packed')).toHaveCount(0)
    } finally {
      patchGate.resolve()
    }
  })

  test('should show cached lists while refreshing on return', async ({ context, page }) => {
    const state = createPackingListRouteState([createPackingListSummary('Cache trail')])

    await mockAuth(context)
    await mockPackingListRoutes(context, page, state)
    await openPackingLists(page)

    const sidebar = page.getByTestId('shell-sidebar')

    await expect(page.getByRole('link', { name: /Cache trail/iu })).toBeVisible()
    expect(state.getRequests).toBe(1)

    state.rows = [createPackingListSummary('Server trail')]
    state.getDelayMs = 500

    await sidebar.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/\/$/u)
    await sidebar.getByRole('link', { name: 'Packing lists' }).click()
    await expect(page).toHaveURL(/\/packing-lists$/u)
    await expect(page.getByRole('heading', { name: 'Loading packing lists' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Cache trail/iu })).toBeVisible()
    await expect(page.getByRole('link', { name: /Server trail/iu })).toBeVisible()
    expect(state.getRequests).toBe(2)
  })
})
