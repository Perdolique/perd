// oxlint-disable-next-line typescript/triple-slash-reference -- Real handlers require the generated Worker globals.
/// <reference path="../../server/types/worker-configuration.d.ts" />
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { eq, sql } from 'drizzle-orm'
import type * as h3 from 'h3'
import * as v from 'valibot'
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  brands,
  categoryProperties,
  contributions,
  equipmentCategories,
  equipmentItemImages,
  equipmentItems,
  itemPropertyValues,
  packingListEntries,
  packingLists,
  userEquipment,
  users
} from '#server/database/schema'

import { createHttpClient, createWebSocketClient } from '#server/utils/database'
import readEdit from '#server/api/equipment/items/[id]/edit.get'
import editItem from '#server/api/equipment/items/[id].patch'
import editSubmission from '#server/api/equipment/item-submissions/[id].patch'
import readItem from '#server/api/equipment/items/[id].get'
import readCatalog from '#server/api/equipment/items/index.get'
import readComparison from '#server/api/equipment/comparisons.get'
import { createTestEvent } from '../../test-utils/create-test-event'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

vi.mock(import('#server/utils/admin'), () => {
  return { async validateAdminUser(event: h3.H3Event) {
    await Promise.resolve()

    return v.parse(v.string(), event.context.testUserId)
  } }
})

vi.mock(import('#server/utils/session'), () => {
  return { async validateSessionUser(event: h3.H3Event) {
    await Promise.resolve()

    return v.parse(v.string(), event.context.testUserId)
  } }
})

vi.mock(import('#server/utils/config'), () => {
  return { createWebSocketClientFromEvent(event: h3.H3Event) {
    const databaseUrl = v.parse(v.string(), event.context.testDatabaseUrl)

    return createWebSocketClient({
      databaseUrl,
      isLocalDatabase: true
    })
  } }
})

// @ts-expect-error -- Vitest rejects this partial h3 module mock.
vi.mock(import('h3'), async () => {
  const actual = await vi.importActual<typeof h3>('h3')

  return {
    ...actual,

    async readValidatedBody(event: h3.H3Event, validate: (body: unknown) => unknown) {
      await Promise.resolve()

      return validate(event.context.testBody)
    },

    async getValidatedRouterParams(event: h3.H3Event, validate: (params: unknown) => unknown) {
      await Promise.resolve()

      return validate(event.context.params)
    },

    async getValidatedQuery(event: h3.H3Event, validate: (query: unknown) => unknown) {
      await Promise.resolve()

      return validate(event.context.testQuery ?? {})
    }
  }
})

let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

function resources() {
  if (isolated === null) { throw new Error('Missing isolated database') }

  return isolated
}

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) { throw new Error('Expected a fixture row') }

  return value
}

async function fixture() {
  const { database } = resources()

  const [account] = await database.insert(users).values({
    isAdmin: true,
    name: 'Admin'
  }).returning()

  const user = required(account)

  const [brandRow] = await database.insert(brands).values({
    name: 'Brand',
    slug: 'brand'
  }).returning()

  const brand = required(brandRow)

  const categories = await database.insert(equipmentCategories).values([{
    name: 'Old',
    slug: 'old'
  }, {
    name: 'New',
    slug: 'new'
  }]).returning()

  const category = required(categories[0])
  const target = required(categories[1])

  const properties = await database.insert(categoryProperties).values([
    {
      categoryId: category.id,
      name: 'Weight',
      slug: 'weight',
      dataType: 'number',
      unit: 'g',
      displayOrder: 0
    },
    {
      categoryId: target.id,
      name: 'Weight',
      slug: 'weight',
      dataType: 'number',
      unit: 'g',
      displayOrder: 0
    }
  ]).returning()

  const property = required(properties[0])
  const targetProperty = required(properties[1])

  const [itemRow] = await database.insert(equipmentItems).values({
    name: 'Original',
    brandId: brand.id,
    categoryId: category.id,
    createdBy: user.id,
    sourceUrl: 'https://example.com/item'
  }).returning()

  const item = required(itemRow)

  await database.insert(itemPropertyValues).values({
    itemId: item.id,
    propertyId: property.id,
    valueNumber: '9007199254740993.125'
  })

  const [image] = await database.insert(equipmentItemImages).values({
    itemId: item.id,
    cloudflareImageId: 'image',
    displayOrder: 0
  }).returning()

  const [gearRow] = await database.insert(userEquipment).values({
    userId: user.id,
    itemId: item.id
  }).returning()

  const gear = required(gearRow)

  const [listRow] = await database.insert(packingLists).values({
    userId: user.id,
    name: 'Trip'
  }).returning()

  const list = required(listRow)

  const [entry] = await database.insert(packingListEntries).values({
    packingListId: list.id,
    userEquipmentId: gear.id,
    isPacked: true
  }).returning()

  return {
    user,
    brand,
    category,
    target,
    property,
    targetProperty,
    item,
    image: required(image),
    gear,
    list,
    entry: required(entry)
  }
}

function eventFor(data: Awaited<ReturnType<typeof fixture>>, body?: unknown, query?: unknown) {
  const event = createTestEvent({})

  event.context.testUserId = data.user.id
  event.context.testDatabaseUrl = resources().databaseUrl
  event.context.testBody = body
  event.context.testQuery = query
  event.context.params = { id: data.item.id }
  event.context.dbHttp = createHttpClient({
    databaseUrl: resources().databaseUrl,
    isLocalDatabase: true
  })

  return event
}

function updateBody(data: Awaited<ReturnType<typeof fixture>>) {
  return {
    name: 'Corrected',
    brandId: data.brand.id,
    categoryId: data.category.id,

    properties: [{
      propertyId: data.property.id,
      value: '0.125'
    }],

    expectedItemRevision: 0,
    expectedOriginalPropertiesRevision: 0,
    expectedPropertiesRevision: 0
  }
}

async function disposeAuditFailureFixtures(database: ReturnType<typeof createWebSocketClient>) {
  const errors: unknown[] = []

  try {
    await database.execute(sql`drop trigger if exists reject_item_audit on contributions`)
  } catch (error) {
    errors.push(error)
  }

  try {
    await database.execute(sql`drop function if exists reject_item_audit()`)
  } catch (error) {
    errors.push(error)
  }

  if (errors.length === 1) {
    throw errors[0]
  }

  if (errors.length > 1) {
    throw new AggregateError(errors, 'Failed to release item audit failure fixtures')
  }
}

describe('published equipment edits on PostgreSQL', () => {
  beforeAll(async () => {
    isolated = await createIsolatedPostgreSQL('item_edits', { httpAccess: true })
  })

  beforeEach(async () => {
    await resources().database.execute(sql`TRUNCATE users, equipment_categories, brands CASCADE`)
  })

  afterAll(async () => {
    await isolated?.dispose()
  })

  it('reads exact values and commits corrected values with audit and preserved references', async () => {
    const data = await fixture()
    const { database } = resources()
    const readBeforeEvent = eventFor(data)
    const before = await readEdit(readBeforeEvent)

    expect(before.properties).toStrictEqual([{
      propertyId: data.property.id,
      value: '9007199254740993.125'
    }])

    expect(before.category.properties[0]).toMatchObject({
      id: data.property.id,
      unit: 'g'
    })

    const body = updateBody(data)
    const editEvent = eventFor(data, body)
    const after = await editItem(editEvent)

    expect(after).toMatchObject({
      name: 'Corrected',
      revision: 1,

      properties: [{
        propertyId: data.property.id,
        value: '0.125'
      }]
    })

    await expect(database.select().from(equipmentItemImages)).resolves.toStrictEqual([data.image])
    await expect(database.select().from(userEquipment)).resolves.toStrictEqual([data.gear])
    await expect(database.select().from(packingListEntries)).resolves.toStrictEqual([data.entry])

    const saved = await database.query.equipmentItems.findFirst({ where: { id: data.item.id } })

    expect(saved).toMatchObject({
      id: data.item.id,
      status: 'approved',
      createdBy: data.user.id,
      sourceUrl: 'https://example.com/item',
      createdAt: data.item.createdAt
    })

    const audit = await database.select().from(contributions)

    expect(audit).toHaveLength(1)

    expect(audit[0]).toMatchObject({
      action: 'update_equipment_item',
      userId: data.user.id,
      targetId: data.item.id,

      metadata: {
        before: {
          name: 'Original',

          properties: [{
            propertyId: data.property.id,
            name: 'Weight',
            unit: 'g',
            value: '9007199254740993.125'
          }]
        },

        after: {
          name: 'Corrected',
          revision: 1,
          properties: [{ value: '0.125' }]
        }
      }
    })

    const readAfterEvent = eventFor(data)
    const updatedItem = readItem(readAfterEvent)

    await expect(updatedItem).resolves.toMatchObject({
      name: 'Corrected',
      isInMyGear: true,
      cloudflareImageId: 'image'
    })
  })

  it('increments the existing item revision when publishing through the submission contract', async () => {
    const data = await fixture()
    const { database } = resources()

    const [pending] = await database
      .update(equipmentItems)
      .set({
        status: 'pending',
        revision: 4
      })
      .where(
        eq(equipmentItems.id, data.item.id)
      )
      .returning()

    const item = required(pending)
    const updatedBody = updateBody(data)
    const expectedUpdatedAt = item.updatedAt.toISOString()

    const body = {
      ...updatedBody,
      expectedUpdatedAt,
      decision: 'publish'
    }

    const editEvent = eventFor(data, body)
    const publish = editSubmission(editEvent)

    await expect(publish).resolves.toMatchObject({ status: 'approved' })

    const readEvent = eventFor(data)
    const snapshot = readEdit(readEvent)

    await expect(snapshot).resolves.toMatchObject({
      revision: 5,
      name: 'Corrected'
    })

    const staleEvent = eventFor(data, body)
    const stalePublish = editSubmission(staleEvent)

    await expect(stalePublish).rejects.toMatchObject({ statusCode: 409 })
  })

  it.each([{
    decision: undefined,
    rejectionReason: undefined,
    status: 'pending'
  }, {
    decision: 'reject',
    rejectionReason: 'Duplicate catalog item',
    status: 'rejected'
  }] as const)('increments the existing item revision when updating a submission to $status', async ({ decision, rejectionReason, status }) => {
    const data = await fixture()
    const { database } = resources()

    const [pending] = await database
      .update(equipmentItems)
      .set({
        status: 'pending',
        revision: 4
      })
      .where(
        eq(equipmentItems.id, data.item.id)
      )
      .returning()

    const item = required(pending)
    const updatedBody = updateBody(data)
    const expectedUpdatedAt = item.updatedAt.toISOString()

    const body = {
      ...updatedBody,
      expectedUpdatedAt,
      decision,
      rejectionReason
    }

    const editEvent = eventFor(data, body)
    const update = editSubmission(editEvent)

    await expect(update).resolves.toMatchObject({ status })

    const saved = database.query.equipmentItems.findFirst({ where: { id: data.item.id } })

    await expect(saved).resolves.toMatchObject({
      revision: 5,
      name: 'Corrected',
      status
    })

    const staleEvent = eventFor(data, body)
    const staleUpdate = editSubmission(staleEvent)

    await expect(staleUpdate).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not write or log normalized no-ops and still rejects stale expectations', async () => {
    const data = await fixture()
    const updatedBody = updateBody(data)

    const body = {
      ...updatedBody,
      name: 'Original',

      properties: [{
        propertyId: data.property.id,
        value: '+09007199254740993.1250'
      }]
    }

    const editEvent = eventFor(data, body)
    const noOp = editItem(editEvent)

    await expect(noOp).resolves.toMatchObject({ revision: 0 })
    await expect(resources().database.select().from(contributions)).resolves.toHaveLength(0)

    const staleBody = {
      ...body,
      expectedItemRevision: 1
    }

    const staleEvent = eventFor(data, staleBody)
    const staleEdit = editItem(staleEvent)

    await expect(staleEdit).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'item_revision_conflict' }
    })
  })

  it('rejects unavailable reference data without changing the item', async () => {
    const data = await fixture()
    const readBeforeEvent = eventFor(data)
    const before = await readEdit(readBeforeEvent)
    const updatedBrandBody = updateBody(data)

    const unavailableBrandBody = {
      ...updatedBrandBody,
      brandId: 2_147_483_647
    }

    const unavailableBrandEvent = eventFor(data, unavailableBrandBody)
    const unavailableBrandEdit = editItem(unavailableBrandEvent)

    await expect(unavailableBrandEdit).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'item_reference_conflict' }
    })

    const updatedCategoryBody = updateBody(data)

    const unavailableCategoryBody = {
      ...updatedCategoryBody,
      categoryId: 2_147_483_647,
      categoryChangeConfirmed: true
    }

    const unavailableCategoryEvent = eventFor(data, unavailableCategoryBody)
    const unavailableCategoryEdit = editItem(unavailableCategoryEvent)

    await expect(unavailableCategoryEdit).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'item_reference_conflict' }
    })

    const readAfterEvent = eventFor(data)
    const snapshot = readEdit(readAfterEvent)

    await expect(snapshot).resolves.toStrictEqual(before)
    await expect(resources().database.select().from(contributions)).resolves.toHaveLength(0)
  })

  it('requires explicit category confirmation and updates catalog filtering and comparison', async () => {
    const data = await fixture()
    const updatedBody = updateBody(data)

    const body = {
      ...updatedBody,
      categoryId: data.target.id,

      properties: [{
        propertyId: data.targetProperty.id,
        value: '9.5'
      }]
    }

    const unconfirmedEvent = eventFor(data, body)
    const unconfirmedEdit = editItem(unconfirmedEvent)

    await expect(unconfirmedEdit).rejects.toMatchObject({ statusCode: 400 })

    const foreignPropertyBody = {
      ...body,
      categoryChangeConfirmed: true,

      properties: [{
        propertyId: data.property.id,
        value: '5'
      }]
    }

    const foreignPropertyEvent = eventFor(data, foreignPropertyBody)
    const foreignPropertyEdit = editItem(foreignPropertyEvent)

    await expect(foreignPropertyEdit).rejects.toMatchObject({ statusCode: 400 })

    const confirmedBody = {
      ...body,
      categoryChangeConfirmed: true
    }

    const confirmedEvent = eventFor(data, confirmedBody)

    await editItem(confirmedEvent)

    const originalCategoryEvent = eventFor(data, undefined, { categorySlug: 'old' })
    const originalCategoryCatalog = readCatalog(originalCategoryEvent)

    await expect(originalCategoryCatalog).resolves.toMatchObject({ total: 0 })

    const targetCategoryEvent = eventFor(data, undefined, { categorySlug: 'new' })
    const targetCategoryCatalog = readCatalog(targetCategoryEvent)

    await expect(targetCategoryCatalog).resolves.toMatchObject({
      total: 1,

      items: [{
        id: data.item.id,
        name: 'Corrected'
      }]
    })

    const [peerRow] = await resources().database.insert(equipmentItems).values({
      name: 'Peer',
      brandId: data.brand.id,
      categoryId: data.target.id
    }).returning()

    const peer = required(peerRow)
    const comparisonEvent = eventFor(data, undefined, { itemId: [data.item.id, peer.id] })
    const comparison = await readComparison(comparisonEvent)

    expect(comparison).toMatchObject({
      category: { id: data.target.id },

      properties: [{ values: [{
        itemId: data.item.id,
        value: 9.5
      }, {
        itemId: peer.id,
        value: null
      }] }]
    })
  })

  it.each(['pending', 'rejected'])('keeps %s items out of the published editor', async (status) => {
    const data = await fixture()
    const { database } = resources()

    await database
      .update(equipmentItems)
      .set({ status })
      .where(
        eq(equipmentItems.id, data.item.id)
      )

    const readEvent = eventFor(data)
    const snapshot = readEdit(readEvent)

    await expect(snapshot).rejects.toMatchObject({ statusCode: 404 })

    const body = updateBody(data)
    const editEvent = eventFor(data, body)
    const unpublishedEdit = editItem(editEvent)

    await expect(unpublishedEdit).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'item_status_conflict' }
    })

    await expect(resources().database.select().from(contributions)).resolves.toHaveLength(0)
  })

  it('allows only one of two saves based on the same revision', async () => {
    const data = await fixture()
    const body = updateBody(data)
    const firstEvent = eventFor(data, body)
    const firstSave = editItem(firstEvent)

    const otherBody = {
      ...body,
      name: 'Other edit'
    }

    const otherEvent = eventFor(data, otherBody)
    const otherSave = editItem(otherEvent)
    const results = await Promise.allSettled([firstSave, otherSave])
    const successes = results.filter((result) => result.status === 'fulfilled')
    const failures = results.filter((result) => result.status === 'rejected')

    expect(successes).toHaveLength(1)

    expect(failures).toMatchObject([{ reason: {
      statusCode: 409,
      data: { code: 'item_revision_conflict' }
    } }])

    await expect(resources().database.select().from(contributions)).resolves.toHaveLength(1)

    const readEvent = eventFor(data)
    const snapshot = readEdit(readEvent)

    await expect(snapshot).resolves.toMatchObject({ revision: 1 })
  })

  it.each(['original', 'target'] as const)('waits for a concurrent %s category change and rejects its stale definition', async (which) => {
    const data = await fixture()
    const { database, rootDatabase } = resources()

    const categoryIds = {
      original: data.category.id,
      target: data.target.id
    }

    const categoryId = categoryIds[which]
    const locked = Promise.withResolvers<boolean>()
    const finish = Promise.withResolvers<boolean>()

    const blocker = database.transaction(async (transaction) => {
      await transaction
        .update(equipmentCategories)
        .set({ propertiesRevision: 1 })
        .where(
          eq(equipmentCategories.id, categoryId)
        )

      locked.resolve(true)

      await finish.promise
    })

    await locked.promise

    async function attemptEdit() {
      try {
        const updatedBody = updateBody(data)

        const body = {
          ...updatedBody,
          categoryId: data.target.id,
          properties: [],
          categoryChangeConfirmed: true
        }

        const editEvent = eventFor(data, body)
        const value = await editItem(editEvent)

        return { value }
      } catch (error) { return { error } }
    }

    const pending = attemptEdit()

    try {
      await expect.poll(async () => {
        const result = await rootDatabase.execute<{ total: number; }>(sql`select count(*)::integer as total from pg_stat_activity where wait_event_type = 'Lock' and query like '%equipment_categories%' and pid <> pg_backend_pid()`)

        return required(result.rows[0]).total
      }, { timeout: 8000 }).toBeGreaterThan(0)
    } finally {
      finish.resolve(true)

      await blocker
    }

    await expect(pending).resolves.toMatchObject({ error: {
      statusCode: 409,
      data: { code: 'properties_revision_conflict' }
    } })

    await expect(database.select().from(contributions)).resolves.toHaveLength(0)

    const readEvent = eventFor(data)
    const snapshot = readEdit(readEvent)

    await expect(snapshot).resolves.toMatchObject({
      name: 'Original',
      revision: 0
    })
  })

  it('rolls back content and revision when contribution persistence fails', async () => {
    const data = await fixture()
    const { database } = resources()
    const log = vi.spyOn(globalThis.console, 'error').mockImplementation(vi.fn<() => void>())

    onTestFinished(async () => {
      try {
        await disposeAuditFailureFixtures(database)
      } finally {
        log.mockRestore()
      }
    })

    await database.execute(sql`create function reject_item_audit() returns trigger language plpgsql as $$ begin raise exception 'forced audit failure'; end $$`)
    await database.execute(sql`create trigger reject_item_audit before insert on contributions for each row execute function reject_item_audit()`)

    const body = updateBody(data)
    const editEvent = eventFor(data, body)
    const failingEdit = editItem(editEvent)

    await expect(failingEdit).rejects.toMatchObject({ statusCode: 500 })

    const readEvent = eventFor(data)
    const snapshot = readEdit(readEvent)

    await expect(snapshot).resolves.toMatchObject({
      name: 'Original',
      revision: 0,
      properties: [{ value: '9007199254740993.125' }]
    })

    await expect(database.select().from(contributions)).resolves.toHaveLength(0)

    const details: unknown = expect.stringContaining('forced audit failure')

    expect(log).toHaveBeenCalledWith('Failed to edit published equipment item', expect.any(Error), expect.objectContaining({ details }))
  })

  it('clears the complete property set explicitly and rejects missing references without writes', async () => {
    const data = await fixture()
    const body = updateBody(data)

    const unavailableBrandBody = {
      ...body,
      brandId: 2_147_483_647
    }

    const unavailableBrandEvent = eventFor(data, unavailableBrandBody)
    const unavailableBrandEdit = editItem(unavailableBrandEvent)

    await expect(unavailableBrandEdit).rejects.toMatchObject({ statusCode: 409 })

    const clearPropertiesBody = {
      ...body,
      properties: []
    }

    const clearPropertiesEvent = eventFor(data, clearPropertiesBody)
    const clearPropertiesEdit = editItem(clearPropertiesEvent)

    await expect(clearPropertiesEdit).resolves.toMatchObject({
      revision: 1,
      properties: []
    })

    await expect(resources().database.select().from(itemPropertyValues)).resolves.toHaveLength(0)
  })
})

describe('equipment revision migration', () => {
  it('initializes existing items without changing their identity or content', async () => {
    const migrationName = '20261004093055_equipment-item-revision'
    const legacy = await createIsolatedPostgreSQL('item_edit_migration', { beforeMigration: migrationName })

    try {
      const [brand] = await legacy.database.insert(brands).values({
        name: 'Existing brand',
        slug: 'existing'
      }).returning({ id: brands.id })

      const [category] = await legacy.database.insert(equipmentCategories).values({
        name: 'Existing category',
        slug: 'existing'
      }).returning({ id: equipmentCategories.id })

      const brandId = required(brand).id
      const categoryId = required(category).id
      const inserted = await legacy.database.execute<{ id: string; }>(sql`insert into equipment_items ("brandId", "categoryId", name) values (${brandId}, ${categoryId}, 'Existing item') returning id`)
      const item = required(inserted.rows[0])
      const path = new URL(`../../server/database/migrations/${migrationName}/migration.sql`, import.meta.url)
      const migration = await readFile(path, 'utf8')

      await legacy.database.execute(sql.raw(migration))

      await expect(legacy.database.query.equipmentItems.findFirst({ where: { id: required(item).id } })).resolves.toMatchObject({
        name: 'Existing item',
        revision: 0,
        status: 'approved'
      })
    } finally { await legacy.dispose() }
  })
})
