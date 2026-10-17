import type { getValidatedRouteParams } from '#server/utils/request'
import type { readMyGear, MyGearRecord } from '#server/utils/my-gear'
import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import * as nuxtServer from 'nuxt/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import updateMyGearHandler from '#server/api/user/gear/[id].patch'
import deleteMyGearHandler from '#server/api/user/gear/[id].delete'
import listMyGearHandler from '#server/api/user/gear/index.get'
import createMyGearHandler from '#server/api/user/gear/index.post'
import { createTestEvent } from '~~/test-utils/create-test-event'

const { getValidatedRouteParamsMock, readValidatedBodyMock, setResponseStatusMock, validateSessionUserMock, readMyGearMock } = vi.hoisted(() => {return {
  getValidatedRouteParamsMock: vi.fn<typeof getValidatedRouteParams>(),
  readValidatedBodyMock: vi.fn<typeof nuxtServer.readValidatedBody>(),
  setResponseStatusMock: vi.fn<typeof nuxtServer.setResponseStatus>(),
  validateSessionUserMock: vi.fn<(event: unknown) => Promise<string>>(),
  readMyGearMock: vi.fn<typeof readMyGear>()
}})

// @ts-expect-error -- The test mock specializes the validator's generic result.
vi.mock(import('#server/utils/request'), () => {return { getValidatedRouteParams: getValidatedRouteParamsMock }})
vi.mock(import('#server/utils/session'), () => {return { validateSessionUser: validateSessionUserMock }})
vi.mock(import('#server/utils/my-gear'), () => {return { readMyGear: readMyGearMock }})

vi.mock(import('nuxt/server'), async () => {
  const actual = await vi.importActual<typeof nuxtServer>('nuxt/server')

  return {
    ...actual,

    async readValidatedBody(...args: Parameters<typeof nuxtServer.readValidatedBody>) {
      return readValidatedBodyMock(...args)
    },

    setResponseStatus(...args: Parameters<typeof nuxtServer.setResponseStatus>) {
      setResponseStatusMock(...args)
    }
  }
})

const id = '0195f6e8-8f44-74f6-bc9a-5c8f7df477d7'

const record: MyGearRecord = {
  id,
  source: 'custom',
  customName: 'DIY stove',
  createdAt: '2026-10-16T00:00:00Z',
  measuredWeightGrams: '18.123456789123456789',
  note: 'No case',
  ownedQuantity: 2
}

interface GearIdentifier {
  id: string;
}

interface DatabaseOptions {
  rows?: GearIdentifier[];
  failure?: Error;
  approved?: boolean;
}

const catalogIdentifier = {
  id,
  customName: null
}

function createDatabase({ rows = [catalogIdentifier], failure, approved = true }: DatabaseOptions = {}) {
  const returning = vi.fn(() => {
    if (failure !== undefined) {
      throw failure
    }

    return rows
  })

  const where = vi.fn((_condition: SQL | undefined) => {return { returning }})
  const values = vi.fn((_values: unknown) => {return { returning }})
  const set = vi.fn((_values: unknown) => {return { where }})
  const findFirst = vi.fn(() => approved ? { id } : undefined)

  const database = {
    insert: vi.fn(() => {return { values }}),
    update: vi.fn(() => {return { set }}),
    delete: vi.fn(() => {return { where }}),
    query: { equipmentItems: { findFirst } }
  }

  return {
    database,
    where,
    values,
    set,
    findFirst,
    returning
  }
}

function query(condition: SQL | undefined) {
  if (condition === undefined) {
    throw new Error('Expected generated SQL')
  }

  const dialect = new PgDialect()

  return dialect.sqlToQuery(condition)
}

function expectFailureLog(action: string, failure: Error, detail: string) {
  const [log] = vi.mocked(console.error).mock.calls

  expect(log?.[0]).toBe(`Failed to ${action} my gear row`)
  expect(log?.[1]).toBe(failure)
  expect(log?.[2]).toHaveProperty('details', expect.stringContaining(detail))
}

const handlers = {
  create: createMyGearHandler,
  update: updateMyGearHandler,
  delete: deleteMyGearHandler,
  load: listMyGearHandler
}

describe('user gear handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    validateSessionUserMock.mockResolvedValue('owner')
    getValidatedRouteParamsMock.mockResolvedValue({ id })
    readValidatedBodyMock.mockResolvedValue({ customName: 'DIY stove' })
    readMyGearMock.mockResolvedValue([record])

    vi.spyOn(console, 'error').mockImplementation(() => {
      // Failure scenarios assert the preserved log separately.
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the current owner through the shared complete-record reader', async () => {
    const { database } = createDatabase()
    const event = createTestEvent(database)

    await expect(listMyGearHandler(event)).resolves.toStrictEqual([record])
    expect(readMyGearMock).toHaveBeenCalledWith(database, 'owner')
  })

  it.each(Object.entries(handlers))('requires authentication before any %s database operation', async (_action, handler) => {
    const { database, returning } = createDatabase()
    const event = createTestEvent(database)

    validateSessionUserMock.mockRejectedValue(nuxtServer.createError({ status: 401 }))
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(returning).not.toHaveBeenCalled()
    expect(readMyGearMock).not.toHaveBeenCalled()
  })

  it('returns committed custom details without a fallible follow-up read', async () => {
    const createdRow = {
      id,
      createdAt: '2026-10-16T00:00:00Z',
      customName: 'DIY stove',
      note: 'No case',
      measuredWeightGrams: '18.12345678912345678900',
      ownedQuantity: 2
    }

    const { database, values, findFirst } = createDatabase({ rows: [createdRow] })

    const body = {
      customName: 'DIY stove',
      note: 'No case',
      measuredWeightGrams: '18.123456789123456789',
      ownedQuantity: 2
    }

    const readFailure = new Error('Follow-up read unavailable after commit')

    readValidatedBodyMock.mockResolvedValue(body)
    readMyGearMock.mockRejectedValue(readFailure)

    const event = createTestEvent(database)

    await expect(createMyGearHandler(event)).resolves.toStrictEqual(record)

    expect(values).toHaveBeenCalledWith({
      userId: 'owner',
      ...body
    })

    expect(findFirst).not.toHaveBeenCalled()
    expect(readMyGearMock).not.toHaveBeenCalled()
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 201)
  })

  it('saves only approved catalog items using their stable ID', async () => {
    const { database, values, findFirst } = createDatabase()

    readValidatedBodyMock.mockResolvedValue({ itemId: id })

    const event = createTestEvent(database)

    await createMyGearHandler(event)

    expect(values).toHaveBeenCalledWith({
      userId: 'owner',
      itemId: id
    })

    expect(findFirst).toHaveBeenCalledWith({
      columns: { id: true },

      where: {
        id,
        status: 'approved'
      }
    })
  })

  it('rejects unavailable catalog items before inserting', async () => {
    const { database, values } = createDatabase({ approved: false })

    readValidatedBodyMock.mockResolvedValue({ itemId: id })
    await expect(createMyGearHandler(createTestEvent(database))).rejects.toMatchObject({ statusCode: 404 })
    expect(values).not.toHaveBeenCalled()
  })

  it.each([{
    code: '23505',
    status: 409
  }, {
    code: undefined,
    status: 500
  }])('uses the PostgreSQL code $code rather than error text to identify duplicate catalog saves', async ({ code, status }) => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint'), { code })
    const failure = new Error('Private SQL connection details', { cause })
    const { database } = createDatabase({ failure })

    await expect(createMyGearHandler(createTestEvent(database))).rejects.toMatchObject({ statusCode: status })
    expectFailureLog('create', failure, cause.message)
  })

  it.each([
    {
      body: {
        note: null,
        measuredWeightGrams: '0',
        ownedQuantity: 2
      },

      sourceSql: '"user_equipment"."userId" ='
    },
    {
      body: { customName: 'New private name' },
      sourceSql: '"user_equipment"."itemId" is null'
    },
    {
      body: { personalName: null },
      sourceSql: '"user_equipment"."itemId" is not null'
    }
  ])('updates only supplied fields and scopes the write to owner and source: $body', async ({ body, sourceSql }) => {
    const { database, set, where } = createDatabase()

    readValidatedBodyMock.mockResolvedValue(body)
    await expect(updateMyGearHandler(createTestEvent(database))).resolves.toStrictEqual(record)

    const filter = query(where.mock.calls[0]?.[0])

    expect(set).toHaveBeenCalledWith(body)
    expect(filter.sql).toContain('"user_equipment"."userId" =')
    expect(filter.sql).toContain('"user_equipment"."id" =')
    expect(filter.params).toStrictEqual([id, 'owner'])
    expect(filter.sql).toContain(sourceSql)
  })

  it.each([updateMyGearHandler, deleteMyGearHandler])('returns 404 for an inaccessible record', async (handler) => {
    const { database } = createDatabase({ rows: [] })

    await expect(handler(createTestEvent(database))).rejects.toMatchObject({ statusCode: 404 })
    expect(readMyGearMock).not.toHaveBeenCalled()
  })

  it.each([createMyGearHandler, updateMyGearHandler])('does not write when body validation fails', async (handler) => {
    const { database, returning } = createDatabase()

    readValidatedBodyMock.mockRejectedValue(nuxtServer.createError({ status: 400 }))
    await expect(handler(createTestEvent(database))).rejects.toMatchObject({ statusCode: 400 })
    expect(returning).not.toHaveBeenCalled()
  })

  it.each([updateMyGearHandler, deleteMyGearHandler])('does not write when route validation fails', async (handler) => {
    const { database, returning } = createDatabase()

    getValidatedRouteParamsMock.mockRejectedValue(nuxtServer.createError({ status: 400 }))
    await expect(handler(createTestEvent(database))).rejects.toMatchObject({ statusCode: 400 })
    expect(returning).not.toHaveBeenCalled()
  })

  it('removes only the current owner record and responds without content', async () => {
    const { database, where } = createDatabase()
    const event = createTestEvent(database)

    await expect(deleteMyGearHandler(event)).resolves.toBeUndefined()

    const filter = query(where.mock.calls[0]?.[0])

    expect(filter.params).toStrictEqual([id, 'owner'])
    expect(filter.sql).toContain('"user_equipment"."userId" =')
    expect(setResponseStatusMock).toHaveBeenCalledWith(event, 204)
  })

  it.each(['23503', '23001'])('preserves referenced gear on database conflict %s', async (code) => {
    const failure = new Error('Referenced gear', { cause: Object.assign(new Error('Referenced row'), { code }) })
    const { database } = createDatabase({ failure })

    await expect(deleteMyGearHandler(createTestEvent(database))).rejects.toMatchObject({ statusCode: 409 })
    expectFailureLog('delete', failure, code)
  })

  it.each(Object.entries(handlers))('keeps raw %s failures in telemetry and returns a safe error', async (action, handler) => {
    const cause = new Error('Raw database failure')
    const failure = new Error('Private SQL connection details', { cause })
    const { database } = createDatabase({ failure })

    readMyGearMock.mockRejectedValue(failure)

    await expect(handler(createTestEvent(database))).rejects.toMatchObject({
      statusCode: 500,
      message: `Failed to ${action} my gear row`
    })

    expectFailureLog(action, failure, cause.message)
  })
})
