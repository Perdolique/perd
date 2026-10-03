import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import readHandler from '#server/api/equipment/categories/[categoryId]/properties/index.get'
import createHandler from '#server/api/equipment/categories/[categoryId]/properties/index.post'
import updateHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/index.patch'
import deleteHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/index.delete'
import orderHandler from '#server/api/equipment/categories/[categoryId]/properties/order.patch'
import createOptionHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/index.post'
import updateOptionHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/[optionId]/index.patch'
import deleteOptionHandler from '#server/api/equipment/categories/[categoryId]/properties/[propertyId]/enum-options/[optionId]/index.delete'
import { createTestEvent } from '~~/test-utils/create-test-event'

const mocks = vi.hoisted(() => {
  return {
    admin: vi.fn(),
    params: vi.fn(),
    body: vi.fn(),
    mutation: vi.fn(),
    snapshot: vi.fn(),
    database: vi.fn(),
    end: vi.fn()
  }
})

vi.mock(import('#server/utils/admin'), () => { return { validateAdminUser: mocks.admin } })
vi.mock(import('#server/utils/config'), () => { return { createWebSocketClientFromEvent: mocks.database } })
vi.mock(import('#server/utils/equipment/category-property-mutations'), () => { return { mutateCategoryProperties: mocks.mutation } })
vi.mock(import('#server/utils/equipment/category-properties'), () => { return { readCategoryPropertiesSnapshot: mocks.snapshot } })

vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,
    getValidatedRouterParams: mocks.params,
    readValidatedBody: mocks.body
  }
})

const snapshot = {
  category: {
    id: 2,
    name: 'Bags',
    slug: 'bags',
    propertiesRevision: 1
  },

  properties: []
}

const routes = [readHandler, createHandler, updateHandler, deleteHandler, orderHandler, createOptionHandler, updateOptionHandler, deleteOptionHandler]

describe('admin characteristics HTTP boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.admin.mockResolvedValue('admin-1')

    mocks.params.mockResolvedValue({
      categoryId: 2,
      propertyId: 3,
      optionId: 4
    })

    mocks.body.mockResolvedValue({
      expectedPropertiesRevision: 0,
      expectedAffectedItemCount: 7,
      name: 'Down',
      slug: 'down'
    })

    mocks.mutation.mockResolvedValue(snapshot)
    mocks.snapshot.mockResolvedValue(snapshot)

    mocks.database.mockReturnValue({
      $client: { end: mocks.end },
      async transaction(operation: (transaction: unknown) => Promise<unknown>) { return operation('transaction') }
    })
  })

  afterEach(() => { vi.restoreAllMocks() })

  it.each(routes)('rejects a non-admin before reading inputs or opening a database client', async (handler) => {
    mocks.admin.mockRejectedValue(h3.createError({ status: 403 }))
    await expect(handler(createTestEvent({}))).rejects.toMatchObject({ statusCode: 403 })
    expect(mocks.params).not.toHaveBeenCalled()
    expect(mocks.database).not.toHaveBeenCalled()
  })

  it('passes the full ownership chain and expected version to enum editing', async () => {
    const result = await updateOptionHandler(createTestEvent({}))

    expect(result).toStrictEqual(snapshot)

    expect(mocks.mutation).toHaveBeenCalledWith('transaction', {
      categoryId: 2,
      expectedPropertiesRevision: 0,
      userId: 'admin-1'
    }, {
      action: 'update_option',
      propertyId: 3,
      optionId: 4,

      settings: {
        name: 'Down',
        slug: 'down'
      }
    })

    expect(mocks.end).toHaveBeenCalledTimes(1)
  })

  it('passes the confirmed deletion count and returns a snapshot with status 200', async () => {
    const event = createTestEvent({})

    await expect(deleteHandler(event)).resolves.toStrictEqual(snapshot)

    expect(mocks.mutation).toHaveBeenCalledWith('transaction', {
      categoryId: 2,
      expectedPropertiesRevision: 0,
      userId: 'admin-1'
    }, {
      action: 'delete',
      propertyId: 3,
      expectedAffectedItemCount: 7
    })

    expect(event.node.res.statusCode).toBe(200)
  })

  it('returns 201 for creation and a read-only repeatable-read snapshot for GET', async () => {
    const event = createTestEvent({})

    await createHandler(event)
    expect(event.node.res.statusCode).toBe(201)

    const transaction = vi.fn(async (operation: (value: unknown) => Promise<unknown>, _configuration: unknown) => operation('read-transaction'))

    mocks.database.mockReturnValue({
      $client: { end: mocks.end },
      transaction
    })

    await expect(readHandler(createTestEvent({}))).resolves.toStrictEqual(snapshot)

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'repeatable read',
      accessMode: 'read only'
    })
  })

  it('logs the raw failure and returns a safe error even when cleanup also fails', async () => {
    const failure = new Error('raw database failure', { cause: new Error('nested cause') })
    const cleanup = new Error('cleanup failed')
    const logger = vi.spyOn(console, 'error').mockImplementation((...messages) => { void messages })

    mocks.mutation.mockRejectedValue(failure)
    mocks.end.mockRejectedValue(cleanup)

    await expect(createHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Could not load or save characteristics. Try again.'
    })

    expect(logger).toHaveBeenCalledWith('Failed to manage category characteristics', failure)
    expect(logger).toHaveBeenCalledWith('Failed to close characteristics database client', cleanup)
  })

  it('does not replace a committed response with a cleanup error', async () => {
    vi.spyOn(console, 'error').mockImplementation((...messages) => { void messages })
    mocks.end.mockRejectedValue(new Error('cleanup failed'))
    await expect(createHandler(createTestEvent({}))).resolves.toStrictEqual(snapshot)
  })

  it('logs client initialization failures and returns a safe error without trying to close a missing client', async () => {
    const failure = new Error('raw configuration failure', { cause: new Error('nested cause') })
    const logger = vi.spyOn(console, 'error').mockImplementation((...messages) => { void messages })

    mocks.database.mockImplementation(() => { throw failure })

    await expect(readHandler(createTestEvent({}))).rejects.toMatchObject({
      statusCode: 500,
      message: 'Could not load or save characteristics. Try again.'
    })

    expect(logger).toHaveBeenCalledWith('Failed to manage category characteristics', failure)
    expect(mocks.end).not.toHaveBeenCalled()
  })
})
