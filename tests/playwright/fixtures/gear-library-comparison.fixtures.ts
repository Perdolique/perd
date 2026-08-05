import type { BrowserContext, Page, Request } from '@playwright/test'

import type { ComparisonResponse } from '../../../server/api/equipment/comparisons.get'
import { expect } from './global.fixtures.ts'

interface ComparisonMockOptions {
  comparison?: (request: Request) => {
    json?: object;
    status?: number;
    waitFor?: Promise<void>;
  };
}

interface ComparisonRequestTracker {
  comparisons: Request[];
}

const comparisonItemIds = [
  '01980000-0000-7000-8000-000000000001',
  '01980000-0000-7000-8000-00000000000a',
  '01980000-0000-7000-8000-000000000003',
  '01980000-0000-7000-8000-000000000004'
] as const

const comparisonItems: ComparisonResponse['items'] = [
  {
    cloudflareImageId: null,
    id: comparisonItemIds[0],
    name: 'PocketRocket Deluxe',
    brand: {
      name: 'MSR',
      slug: 'msr'
    }
  },
  {
    cloudflareImageId: null,
    id: comparisonItemIds[1],
    name: 'WindBurner',
    brand: {
      name: 'MSR',
      slug: 'msr'
    }
  },
  {
    cloudflareImageId: null,
    id: comparisonItemIds[2],
    name: 'Lite Plus',
    brand: {
      name: 'Primus',
      slug: 'primus'
    }
  },
  {
    cloudflareImageId: null,
    id: comparisonItemIds[3],
    name: 'Flash',
    brand: {
      name: 'Jetboil',
      slug: 'jetboil'
    }
  }
]

const comparisonResponse: ComparisonResponse = {
  category: {
    id: 7,
    name: 'Stoves',
    slug: 'stoves'
  },
  items: comparisonItems,
  properties: [
    {
      dataType: 'number',
      id: 10,
      name: 'Weight',
      slug: 'weight',
      unit: 'g',
      values: [
        { itemId: comparisonItemIds[0], value: 83 },
        { itemId: comparisonItemIds[1], value: 83 },
        { itemId: comparisonItemIds[2], value: null },
        { itemId: comparisonItemIds[3], value: 371 }
      ]
    },
    {
      dataType: 'enum',
      id: 11,
      name: 'Fuel type',
      slug: 'fuel-type',
      unit: null,
      values: comparisonItemIds.map((itemId) => {
        return {
          enumOptionName: 'Gas canister',
          itemId,
          value: 'gas-canister'
        }
      })
    },
    {
      dataType: 'boolean',
      id: 12,
      name: 'Piezo ignition',
      slug: 'piezo-ignition',
      unit: null,
      values: [
        { itemId: comparisonItemIds[0], value: true },
        { itemId: comparisonItemIds[1], value: false },
        { itemId: comparisonItemIds[2], value: true },
        { itemId: comparisonItemIds[3], value: true }
      ]
    }
  ]
}

function createComparisonResponse(itemIds: readonly string[]): ComparisonResponse {
  const itemsById = new Map(comparisonResponse.items.map((item) => [item.id, item]))
  const items: ComparisonResponse['items'] = []

  for (const itemId of itemIds) {
    const item = itemsById.get(itemId)

    if (item !== undefined) {
      items.push(item)
    }
  }

  const itemIdSet = new Set(itemIds)
  const properties = comparisonResponse.properties.map((property) => {
    const values = property.values.filter((value) => itemIdSet.has(value.itemId))

    return {
      dataType: property.dataType,
      id: property.id,
      name: property.name,
      slug: property.slug,
      unit: property.unit,
      values
    }
  })

  return {
    category: comparisonResponse.category,
    items,
    properties
  }
}

function getMockResponse(
  resolver: ComparisonMockOptions[keyof ComparisonMockOptions],
  request: Request,
  fallback: object
) {
  return resolver?.(request) ?? {
    json: fallback,
    status: 200
  }
}

async function fulfillMockResponse(
  route: Parameters<Parameters<BrowserContext['route']>[1]>[0],
  response: {
    json?: object;
    status?: number;
    waitFor?: Promise<void>;
  }
) {
  if (response.waitFor !== undefined) {
    await response.waitFor
  }

  await route.fulfill({
    json: response.json ?? {},
    status: response.status ?? 200
  })
}

async function mockComparisonApi(
  context: BrowserContext,
  options: ComparisonMockOptions = {}
): Promise<ComparisonRequestTracker> {
  const tracker: ComparisonRequestTracker = {
    comparisons: []
  }

  await context.route((url) => url.pathname === '/api/equipment/comparisons', async (route) => {
    const request = route.request()
    tracker.comparisons.push(request)

    const requestUrl = new globalThis.URL(request.url())
    const itemIds = requestUrl.searchParams.getAll('itemId')
    const defaultResponse = createComparisonResponse(itemIds)
    const response = getMockResponse(options.comparison, request, defaultResponse)
    await fulfillMockResponse(route, response)
  })

  return tracker
}

function createComparisonPath(itemIds: readonly string[]) {
  const query = new globalThis.URLSearchParams()

  for (const itemId of itemIds) {
    query.append('item', itemId)
  }

  return `/gear-library/compare?${query.toString()}`
}

async function openComparisonPage(
  page: Page,
  itemIds: readonly string[] = comparisonItemIds.slice(0, 3)
) {
  const path = createComparisonPath(itemIds)
  const redirectTo = encodeURIComponent(path)

  await page.goto(`/login?redirectTo=${redirectTo}`)
  await page.getByRole('button', { name: 'Guest' }).click()

  await expect.poll(() => {
    const currentUrl = new globalThis.URL(page.url())

    return currentUrl.pathname
  }).toBe('/gear-library/compare')
}

export {
  comparisonItemIds,
  comparisonItems,
  comparisonResponse,
  createComparisonResponse,
  createComparisonPath,
  mockComparisonApi,
  openComparisonPage,
  type ComparisonMockOptions,
  type ComparisonRequestTracker
}
