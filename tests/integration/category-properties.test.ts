// oxlint-disable-next-line typescript/triple-slash-reference -- Real item handlers need the generated Worker globals in this Node test project.
/// <reference path="../../server/types/worker-configuration.d.ts" />
import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { and, eq, sql } from 'drizzle-orm'
import type * as h3 from 'h3'
import * as v from 'valibot'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
  propertyEnumOptions,
  userEquipment,
  users
} from '#server/database/schema'

import { createHttpClient, createWebSocketClient } from '#server/utils/database'
import { mutateCategoryProperties } from '#server/utils/equipment/category-property-mutations'
import { readCategoryPropertiesSnapshot } from '#server/utils/equipment/category-properties'
import * as propertyPersistence from '#server/utils/equipment/category-properties'
import readCategory from '#server/api/equipment/categories/by-slug/[slug].get'
import readItem from '#server/api/equipment/items/[id].get'
import readComparison from '#server/api/equipment/comparisons.get'
import readCatalog from '#server/api/equipment/items/index.get'
import createSubmission from '#server/api/equipment/item-submissions/index.post'
import updateSubmission from '#server/api/equipment/item-submissions/[id].patch'
import readSubmission from '#server/api/equipment/item-submissions/[id].get'
import { createTestEvent } from '../../test-utils/create-test-event'
import { createIsolatedPostgreSQL } from '../../test-utils/isolated-postgresql'

vi.mock(import('#server/utils/admin'), () => {
  return {
    async validateAdminUser(event: h3.H3Event) {
      await Promise.resolve()

      const id: unknown = event.context.testUserId

      return v.parse(v.string(), id)
    }
  }
})

vi.mock(import('#server/utils/user'), () => {
  return {
    async validateRegisteredUserAccess(event: h3.H3Event) {
      await Promise.resolve()

      const userId = v.parse(v.string(), event.context.testUserId)

      return {
        isAdmin: true,
        userId
      }
    }
  }
})

vi.mock(import('#server/utils/session'), () => {
  return { async validateSessionUser(event: h3.H3Event) {
    await Promise.resolve()

    return v.parse(v.string(), event.context.testUserId)
  } }
})

vi.mock(import('#server/utils/config'), () => {
  return {
    createWebSocketClientFromEvent(event: h3.H3Event) {
      return createWebSocketClient({
        databaseUrl: v.parse(v.string(), event.context.testDatabaseUrl),
        isLocalDatabase: true
      })
    }
  }
})

// @ts-expect-error -- Vitest's import-based module mock typing rejects this partial h3 mock.
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

      return validate(event.context.testQuery)
    }
  }
})

function required<Value>(rows: Value[]): Value {
  const [row] = rows

  if (row === undefined) { throw new Error('Expected a database row') }

  return row
}

let isolated: Awaited<ReturnType<typeof createIsolatedPostgreSQL>> | null = null

function resources() {
  if (isolated === null) { throw new Error('Isolated database is not initialized') }

  return isolated
}
async function fixture() {
  const { database } = resources()

  const user = required(await database.insert(users).values({
    name: 'Admin',
    isAdmin: true
  }).returning())

  const category = required(await database.insert(equipmentCategories).values({
    name: 'Bags',
    slug: 'bags'
  }).returning())

  const brand = required(await database.insert(brands).values({
    name: 'Brand',
    slug: 'brand'
  }).returning())

  const properties = await database.insert(categoryProperties).values([
    {
      categoryId: category.id,
      name: 'Fill',
      slug: 'fill',
      dataType: 'enum',
      displayOrder: 0
    },
    {
      categoryId: category.id,
      name: 'Temperature',
      slug: 'temperature',
      dataType: 'number',
      unit: 'C',
      allowsNegativeValues: true,
      displayOrder: 4
    },
    {
      categoryId: category.id,
      name: 'Flag',
      slug: 'flag',
      dataType: 'boolean',
      displayOrder: 7
    },
    {
      categoryId: category.id,
      name: 'Notes',
      slug: 'notes',
      dataType: 'text',
      displayOrder: 9
    }
  ]).returning()

  const fill = required(properties.filter((property) => property.slug === 'fill'))
  const temperature = required(properties.filter((property) => property.slug === 'temperature'))
  const flag = required(properties.filter((property) => property.slug === 'flag'))
  const notes = required(properties.filter((property) => property.slug === 'notes'))

  const options = await database.insert(propertyEnumOptions).values([
    {
      propertyId: fill.id,
      name: 'Down',
      slug: 'down'
    },
    {
      propertyId: fill.id,
      name: 'Synthetic',
      slug: 'synthetic'
    }
  ]).returning()

  const down = required(options.filter((option) => option.slug === 'down'))
  const synthetic = required(options.filter((option) => option.slug === 'synthetic'))

  const items = await database.insert(equipmentItems).values(['approved', 'pending', 'rejected'].map((status) => {
    return {
      categoryId: category.id,
      brandId: brand.id,
      name: status,
      status,
      createdBy: user.id
    }
  })).returning()

  const approved = required(items.filter((item) => item.status === 'approved'))
  const pending = required(items.filter((item) => item.status === 'pending'))

  const values = items.map((item) => {
    return {
      itemId: item.id,
      propertyId: fill.id,
      valueText: 'down'
    }
  })

  await database.insert(itemPropertyValues).values([
    ...values,
    {
      itemId: approved.id,
      propertyId: temperature.id,
      valueNumber: '0'
    },
    {
      itemId: pending.id,
      propertyId: temperature.id,
      valueNumber: '-10'
    },
    {
      itemId: approved.id,
      propertyId: flag.id,
      valueBoolean: false
    }
  ])

  const image = required(await database.insert(equipmentItemImages).values({
    itemId: approved.id,
    cloudflareImageId: 'test-image',
    displayOrder: 0
  }).returning())

  const gear = required(await database.insert(userEquipment).values({
    itemId: approved.id,
    userId: user.id
  }).returning())

  const list = required(await database.insert(packingLists).values({
    name: 'Trip',
    userId: user.id
  }).returning())

  const entry = required(await database.insert(packingListEntries).values({
    packingListId: list.id,
    userEquipmentId: gear.id
  }).returning())

  const context = {
    categoryId: category.id,
    userId: user.id,
    expectedPropertiesRevision: 0
  }

  return {
    context,
    category,
    brand,
    properties,
    fill,
    temperature,
    flag,
    notes,
    down,
    synthetic,
    items,
    approved,
    pending,
    image,
    gear,
    list,
    entry
  }
}

function submissionEvent(data: Awaited<ReturnType<typeof fixture>>, body: unknown, id?: string) {
  const event = createTestEvent({})

  event.context.testUserId = data.context.userId
  event.context.testDatabaseUrl = resources().databaseUrl
  event.context.testBody = body
  event.context.params = id === undefined ? {} : { id }

  return event
}

async function waitForBlockedQueries(fragment: string, count = 1): Promise<void> {
  await expect.poll(async () => {
    const result = await resources().rootDatabase.execute<{ total: number; }>(sql`
      select count(*)::integer as total from pg_stat_activity
      where wait_event_type = 'Lock' and query like ${`%${fragment}%`}
      and pid <> pg_backend_pid()
    `)

    return result.rows[0]?.total ?? 0
  }, { timeout: 8000 }).toBe(count)
}

function gate() {
  // oxlint-disable-next-line typescript/no-invalid-void-type -- A barrier resolves without a payload.
  const barrier = Promise.withResolvers<void>()

  return {
    promise: barrier.promise,
    release: barrier.resolve
  }
}

async function holdCategory(categoryId: number, mode: 'update' | 'share') {
  const locked = gate()
  const finish = gate()

  const completion = resources().database.transaction(async (transaction) => {
    await transaction.select().from(equipmentCategories).where(eq(equipmentCategories.id, categoryId)).for(mode)
    locked.release()

    await finish.promise
  })

  await locked.promise

  return {
    completion,
    release: finish.release
  }
}

describe('category characteristics on PostgreSQL', () => {
  beforeAll(async () => {
    isolated = await createIsolatedPostgreSQL('category_properties', { httpAccess: true })
  })

  beforeEach(async () => {
    await resources().database.execute(sql`TRUNCATE users, equipment_categories, brands CASCADE`)
  })

  afterAll(async () => {
    await isolated?.dispose()
  })

  it('counts all statuses, false, zero, and negative values without changing IDs', async () => {
    const data = await fixture()

    const snapshot = await resources().database.transaction(async (transaction) => readCategoryPropertiesSnapshot(transaction, data.category.id), {
      isolationLevel: 'repeatable read',
      accessMode: 'read only'
    })

    expect(snapshot.category.propertiesRevision).toBe(0)

    expect(snapshot.properties.map((property) => [property.id, property.usedItemCount, property.negativeValueCount])).toStrictEqual([
      [data.fill.id, 3, 0], [data.temperature.id, 2, 1], [data.flag.id, 1, 0], [data.notes.id, 0, 0]
    ])

    expect(snapshot.properties[0]?.enumOptions.map((option) => [option.id, option.usedItemCount])).toStrictEqual([[data.down.id, 3], [data.synthetic.id, 0]])
  })

  it('renames an enum slug for every status and leaves neighboring options and values intact', async () => {
    const data = await fixture()
    const { database } = resources()

    await database.insert(itemPropertyValues).values({
      propertyId: data.fill.id,

      itemId: required(await database.insert(equipmentItems).values({
        categoryId: data.category.id,
        brandId: data.brand.id,
        name: 'Synthetic'
      }).returning()).id,

      valueText: 'synthetic'
    })

    const result = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update_option',
      propertyId: data.fill.id,
      optionId: data.down.id,

      settings: {
        name: 'Duck down',
        slug: 'duck-down'
      }
    }))

    expect(result.category.propertiesRevision).toBe(1)

    const fillValues = await database.select().from(itemPropertyValues).where(eq(itemPropertyValues.propertyId, data.fill.id))

    expect(fillValues.map((value) => value.valueText)).toStrictEqual(expect.arrayContaining(['duck-down', 'duck-down', 'duck-down', 'synthetic']))

    const contribution = required(await database.select().from(contributions))

    expect(contribution).toMatchObject({
      targetId: `${data.down.id}`,

      metadata: {
        affectedItemCount: 3,
        oldSettings: { slug: 'down' },
        newSettings: { slug: 'duck-down' }
      }
    })

    await expect(database.select().from(propertyEnumOptions).where(eq(propertyEnumOptions.id, data.synthetic.id))).resolves.toMatchObject([{ slug: 'synthetic' }])
    await expect(database.select().from(itemPropertyValues).where(eq(itemPropertyValues.propertyId, data.temperature.id))).resolves.toHaveLength(2)
  })

  it('deletes only the confirmed characteristic and its values, preserving items, images, gear, and packing lists', async () => {
    const data = await fixture()
    const { database } = resources()

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete',
      propertyId: data.fill.id,
      expectedAffectedItemCount: 2
    }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'affected_item_count_conflict' }
    })

    const result = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete',
      propertyId: data.fill.id,
      expectedAffectedItemCount: 3
    }))

    expect(result.properties.map((property) => property.displayOrder)).toStrictEqual([0, 1, 2])
    await expect(database.select().from(propertyEnumOptions)).resolves.toHaveLength(0)
    await expect(database.select().from(itemPropertyValues)).resolves.toHaveLength(3)
    await expect(database.select().from(equipmentItems)).resolves.toStrictEqual(data.items)
    await expect(database.select().from(equipmentItemImages)).resolves.toStrictEqual([data.image])
    await expect(database.select().from(userEquipment)).resolves.toStrictEqual([data.gear])
    await expect(database.select().from(packingLists)).resolves.toStrictEqual([data.list])
    await expect(database.select().from(packingListEntries)).resolves.toStrictEqual([data.entry])
  })

  it('allows names and slugs, blocks representation changes and negative-value restrictions, and does not log no-ops', async () => {
    const data = await fixture()
    const { database } = resources()

    const settings = {
      expectedPropertiesRevision: 0,
      name: 'Temperature',
      slug: 'temperature',
      dataType: 'number' as const,
      unit: 'C',
      allowsNegativeValues: true
    }

    await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update',
      propertyId: data.temperature.id,
      settings
    }))

    await expect(database.select().from(contributions)).resolves.toHaveLength(0)

    for (const replacement of [{
      ...settings,
      unit: 'F'
    }, {
      ...settings,
      dataType: 'text' as const
    }, {
      ...settings,
      allowsNegativeValues: false
    }]) {
      // oxlint-disable-next-line no-await-in-loop -- Each rejected edit must leave the same initial revision intact.
      await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
        action: 'update',
        propertyId: data.temperature.id,
        settings: replacement
      }))).rejects.toMatchObject({ statusCode: 409 })
    }

    const result = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update',
      propertyId: data.temperature.id,

      settings: {
        ...settings,
        name: 'Comfort',
        slug: 'comfort'
      }
    }))

    expect(result.properties.find((property) => property.id === data.temperature.id)).toMatchObject({
      name: 'Comfort',
      slug: 'comfort',
      usedItemCount: 2
    })

    expect(result.category.propertiesRevision).toBe(1)
  })

  it('enforces the category-property-option chain, unique slugs, used options, last options, and enum transitions', async () => {
    const data = await fixture()
    const { database } = resources()

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete_option',
      propertyId: data.fill.id,
      optionId: data.down.id
    }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'option_in_use' }
    })

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update_option',
      propertyId: data.fill.id,
      optionId: data.down.id,

      settings: {
        name: 'Other',
        slug: 'synthetic'
      }
    }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'option_slug_conflict' }
    })

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete_option',
      propertyId: data.notes.id,
      optionId: data.down.id
    }))).rejects.toMatchObject({ statusCode: 404 })

    const otherCategory = required(await database.insert(equipmentCategories).values({
      name: 'Other',
      slug: 'other'
    }).returning())

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, {
      ...data.context,
      categoryId: otherCategory.id
    }, {
      action: 'delete',
      propertyId: data.notes.id,
      expectedAffectedItemCount: 0
    }))).rejects.toMatchObject({ statusCode: 404 })

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete_option',
      propertyId: data.fill.id,
      optionId: data.down.id + 1000
    }))).rejects.toMatchObject({ statusCode: 404 })

    const settings = {
      expectedPropertiesRevision: 0,
      name: 'Notes',
      slug: 'notes',
      dataType: 'enum' as const,
      allowsNegativeValues: false
    }

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update',
      propertyId: data.notes.id,
      settings
    }))).rejects.toMatchObject({ statusCode: 400 })

    const result = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update',
      propertyId: data.notes.id,

      settings: {
        ...settings,

        enumOptions: [{
          name: 'Only',
          slug: 'only'
        }]
      }
    }))

    const enumProperty = required(result.properties.filter((property) => property.id === data.notes.id))
    const only = required(enumProperty.enumOptions)

    const current = {
      ...data.context,
      expectedPropertiesRevision: 1
    }

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, current, {
      action: 'delete_option',
      propertyId: data.notes.id,
      optionId: only.id
    }))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'last_enum_option' }
    })

    const textResult = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, current, {
      action: 'update',
      propertyId: data.notes.id,

      settings: {
        ...settings,
        dataType: 'text'
      }
    }))

    expect(textResult.properties.find((property) => property.id === data.notes.id)?.enumOptions).toStrictEqual([])
  })

  it('reorders sparse positions without uniqueness conflicts and rejects incomplete orders', async () => {
    const data = await fixture()
    const { database } = resources()
    const ids = data.properties.map((property) => property.id).toReversed()

    await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'order',
      propertyIds: ids.slice(1)
    }))).rejects.toMatchObject({ statusCode: 400 })

    const result = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'order',
      propertyIds: ids
    }))

    expect(result.properties.map((property) => [property.id, property.displayOrder])).toStrictEqual(ids.map((id, index) => [id, index]))

    await expect(database.select().from(contributions)).resolves.toMatchObject([{ metadata: {
      oldOrder: ids.toReversed(),
      newOrder: ids
    } }])

    const sameOrder = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, {
      ...data.context,
      expectedPropertiesRevision: 1
    }, {
      action: 'order',
      propertyIds: ids
    }))

    expect(sameOrder.category.propertiesRevision).toBe(1)
    await expect(database.select().from(contributions)).resolves.toHaveLength(1)
  })

  it('keeps enum no-ops at the same revision and deletes only an unused option', async () => {
    const data = await fixture()
    const { database } = resources()

    const unchanged = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update_option',
      propertyId: data.fill.id,
      optionId: data.down.id,

      settings: {
        name: data.down.name,
        slug: data.down.slug
      }
    }))

    expect(unchanged.category.propertiesRevision).toBe(0)
    await expect(database.select().from(contributions)).resolves.toHaveLength(0)

    const values = await database.select().from(itemPropertyValues)

    const deleted = await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete_option',
      propertyId: data.fill.id,
      optionId: data.synthetic.id
    }))

    expect(deleted.category.propertiesRevision).toBe(1)
    expect(deleted.properties.find((property) => property.id === data.fill.id)?.enumOptions).toMatchObject([{ id: data.down.id }])
    await expect(database.select().from(propertyEnumOptions)).resolves.toHaveLength(1)
    await expect(database.select().from(itemPropertyValues)).resolves.toStrictEqual(values)
    await expect(database.select().from(contributions)).resolves.toHaveLength(1)
  })

  it.each(['update_option', 'delete', 'order'] as const)('rolls back values, definitions, options, order, and revision when contribution fails during %s', async (action) => {
    const data = await fixture()
    const { database } = resources()
    const before = await database.transaction(async (transaction) => readCategoryPropertiesSnapshot(transaction, data.category.id))
    const oldValues = await database.select().from(itemPropertyValues)

    await database.execute(sql`CREATE FUNCTION fail_contribution() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test contribution failure'; END $$`)
    await database.execute(sql`CREATE TRIGGER fail_contribution BEFORE INSERT ON contributions FOR EACH ROW EXECUTE FUNCTION fail_contribution()`)

    const mutations = {
      update_option: {
        action: 'update_option' as const,
        propertyId: data.fill.id,
        optionId: data.down.id,

        settings: {
          name: 'New',
          slug: 'new'
        }
      },

      delete: {
        action: 'delete' as const,
        propertyId: data.fill.id,
        expectedAffectedItemCount: 3
      },

      order: {
        action: 'order' as const,
        propertyIds: data.properties.map((property) => property.id).toReversed()
      }
    }

    const mutation = mutations[action]

    try {
      await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, mutation))).rejects.toThrow('Failed query')
      await expect(database.transaction(async (transaction) => readCategoryPropertiesSnapshot(transaction, data.category.id))).resolves.toStrictEqual(before)
      await expect(database.select().from(itemPropertyValues)).resolves.toStrictEqual(oldValues)
      await expect(database.select().from(contributions)).resolves.toHaveLength(0)
    } finally {
      await database.execute(sql`DROP TRIGGER fail_contribution ON contributions`)
      await database.execute(sql`DROP FUNCTION fail_contribution()`)
    }
  })

  it('rolls back an edit if its response snapshot cannot be read', async () => {
    const data = await fixture()
    const { database } = resources()
    const read = propertyPersistence.readCategoryPropertiesSnapshot
    let reads = 0
    const failure = new Error('snapshot failed')

    const spy = vi.spyOn(propertyPersistence, 'readCategoryPropertiesSnapshot').mockImplementation(async (transaction, categoryId) => {
      reads += 1

      // oxlint-disable-next-line vitest/no-conditional-in-test -- Fault injection targets the post-write response read.
      if (reads === 2) { throw failure }

      return read(transaction, categoryId)
    })

    try {
      await expect(database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
        action: 'update_option',
        propertyId: data.fill.id,
        optionId: data.down.id,

        settings: {
          name: 'Duck',
          slug: 'duck'
        }
      }))).rejects.toBe(failure)

      await expect(database.select().from(propertyEnumOptions).where(eq(propertyEnumOptions.id, data.down.id))).resolves.toMatchObject([{ slug: 'down' }])
      await expect(database.select().from(equipmentCategories)).resolves.toMatchObject([{ propertiesRevision: 0 }])
      await expect(database.select().from(contributions)).resolves.toHaveLength(0)
    } finally { spy.mockRestore() }
  })

  it('returns changed definitions, values, names, options, and order through every public consumer', async () => {
    const data = await fixture()
    const { database } = resources()

    const second = required(await database.insert(equipmentItems).values({
      categoryId: data.category.id,
      brandId: data.brand.id,
      name: 'Second approved'
    }).returning())

    await database.insert(itemPropertyValues).values({
      itemId: second.id,
      propertyId: data.fill.id,
      valueText: 'synthetic'
    })

    await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update',
      propertyId: data.fill.id,

      settings: {
        expectedPropertiesRevision: 0,
        name: 'Insulation',
        slug: 'insulation',
        dataType: 'enum',
        allowsNegativeValues: false
      }
    }))

    await database.transaction(async (transaction) => mutateCategoryProperties(transaction, {
      ...data.context,
      expectedPropertiesRevision: 1
    }, {
      action: 'update_option',
      propertyId: data.fill.id,
      optionId: data.down.id,

      settings: {
        name: 'Duck down',
        slug: 'duck-down'
      }
    }))

    await database.transaction(async (transaction) => mutateCategoryProperties(transaction, {
      ...data.context,
      expectedPropertiesRevision: 2
    }, {
      action: 'order',
      propertyIds: [data.flag.id, data.temperature.id, data.fill.id, data.notes.id]
    }))

    const http = createHttpClient({
      databaseUrl: resources().databaseUrl,
      isLocalDatabase: true
    })

    const categoryEvent = createTestEvent(http)

    categoryEvent.context.params = { slug: 'bags' }

    const category = await readCategory(categoryEvent)

    expect(category.propertiesRevision).toBe(3)
    expect(category.properties.map((property) => property.name)).toStrictEqual(['Flag', 'Temperature', 'Insulation', 'Notes'])

    expect(category.properties[2]?.enumOptions).toMatchObject([{
      name: 'Duck down',
      slug: 'duck-down'
    }, {
      name: 'Synthetic',
      slug: 'synthetic'
    }])

    const submissionReadEvent = createTestEvent(http)

    submissionReadEvent.context.params = { id: data.pending.id }
    submissionReadEvent.context.testUserId = data.context.userId

    const submission = await readSubmission(submissionReadEvent)

    expect(submission.propertiesRevision).toBe(3)

    expect(submission.category).toStrictEqual({
      id: data.category.id,
      name: data.category.name
    })

    expect(submission.properties).toContainEqual({
      propertyId: data.fill.id,
      value: 'duck-down'
    })

    const itemEvent = createTestEvent(http)

    itemEvent.context.params = { id: data.approved.id }
    itemEvent.context.testUserId = data.context.userId

    const item = await readItem(itemEvent)

    expect(item.properties.map((property) => property.name)).toStrictEqual(['Flag', 'Temperature', 'Insulation'])

    expect(item.properties[2]).toMatchObject({
      slug: 'insulation',
      value: 'duck-down',
      enumOptionName: 'Duck down'
    })

    const comparisonEvent = createTestEvent(http)

    comparisonEvent.context.testQuery = { itemId: [data.approved.id, second.id] }

    const comparison = await readComparison(comparisonEvent)

    expect(comparison.properties.map((property) => property.name)).toStrictEqual(['Flag', 'Temperature', 'Insulation', 'Notes'])

    expect(comparison.properties[2]?.values).toStrictEqual([{
      itemId: data.approved.id,
      value: 'duck-down',
      enumOptionName: 'Duck down'
    }, {
      itemId: second.id,
      value: 'synthetic',
      enumOptionName: 'Synthetic'
    }])

    const filterEvent = createTestEvent(http)

    filterEvent.context.testQuery = {
      categorySlug: 'bags',
      enumFilter: 'insulation:duck-down'
    }
    filterEvent.context.testUserId = data.context.userId

    const filtered = await readCatalog(filterEvent)

    expect(filtered.items.map((entry) => entry.id)).toStrictEqual([data.approved.id])

    await database.transaction(async (transaction) => mutateCategoryProperties(transaction, {
      ...data.context,
      expectedPropertiesRevision: 3
    }, {
      action: 'delete',
      propertyId: data.fill.id,
      expectedAffectedItemCount: 4
    }))

    const remainingItem = await readItem(itemEvent)

    expect(remainingItem.properties.map((property) => property.name)).toStrictEqual(['Flag', 'Temperature'])

    const remainingComparison = await readComparison(comparisonEvent)

    expect(remainingComparison.properties.map((property) => property.name)).toStrictEqual(['Flag', 'Temperature', 'Notes'])
  })

  it('serializes two edits with one revision to one success and one conflict', async () => {
    const data = await fixture()
    const lock = await holdCategory(data.category.id, 'update')

    const settings = {
      expectedPropertiesRevision: 0,
      name: 'New',
      slug: 'new',
      dataType: 'text' as const,
      allowsNegativeValues: false
    }

    const attempts = [1, 2].map(async () => resources().database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'create',
      settings
    })))

    const outcomes = Promise.allSettled(attempts)

    try { await waitForBlockedQueries('"equipment_categories"', 2) } finally { lock.release() }

    await lock.completion

    const results = await outcomes

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)

    const rejected = required(results.filter((result) => result.status === 'rejected'))

    expect(rejected.reason).toMatchObject({
      statusCode: 409,
      data: { code: 'properties_revision_conflict' }
    })

    await expect(resources().database.select().from(contributions)).resolves.toHaveLength(1)
  })

  it('makes deletion wait for item submission values and rejects a now-stale confirmed count', async () => {
    const data = await fixture()
    const { database } = resources()
    const acquired = gate()
    const finish = gate()

    const submission = database.transaction(async (transaction) => {
      await transaction.select().from(equipmentCategories).where(eq(equipmentCategories.id, data.category.id)).for('share')
      acquired.release()

      await finish.promise

      await transaction.insert(itemPropertyValues).values({
        itemId: data.pending.id,
        propertyId: data.notes.id,
        valueText: 'new value'
      })
    })

    await acquired.promise

    const deletion = database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'delete',
      propertyId: data.notes.id,
      expectedAffectedItemCount: 0
    }))

    // oxlint-disable-next-line vitest/valid-expect -- Attach rejection handling before releasing the blocking transaction; awaited below.
    const outcome = expect(deletion).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'affected_item_count_conflict' }
    })

    try { await waitForBlockedQueries('"equipment_categories"') } finally { finish.release() }

    await submission
    await outcome

    await expect(database.select().from(itemPropertyValues).where(eq(itemPropertyValues.propertyId, data.notes.id))).resolves.toMatchObject([{ valueText: 'new value' }])
  })

  it.each(['delete', 'update_option'] as const)('blocks a real submission during %s then rejects its obsolete revision', async (action) => {
    const data = await fixture()
    const { database } = resources()
    const acquired = gate()
    const finish = gate()

    const edit = database.transaction(async (transaction) => {
      const mutations = {
        delete: {
          action: 'delete' as const,
          propertyId: data.fill.id,
          expectedAffectedItemCount: 3
        },

        update_option: {
          action: 'update_option' as const,
          propertyId: data.fill.id,
          optionId: data.down.id,

          settings: {
            name: 'New down',
            slug: 'new-down'
          }
        }
      }

      const mutation = mutations[action]

      await mutateCategoryProperties(transaction, data.context, mutation)
      acquired.release()

      await finish.promise
    })

    await acquired.promise

    const body = {
      brandId: data.brand.id,
      categoryId: data.category.id,
      name: 'Obsolete item',
      sourceUrl: 'https://example.com/item',
      expectedPropertiesRevision: 0,

      properties: [{
        propertyId: data.fill.id,
        value: 'down'
      }]
    }

    const attempt = createSubmission(submissionEvent(data, body))

    // oxlint-disable-next-line vitest/valid-expect -- Attach rejection handling before releasing the blocking transaction; awaited below.
    const outcome = expect(attempt).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'properties_revision_conflict' }
    })

    try { await waitForBlockedQueries('"equipment_categories"') } finally { finish.release() }

    await edit
    await outcome

    await expect(database.select().from(equipmentItems)).resolves.toHaveLength(3)
    await expect(database.select().from(itemPropertyValues).where(and(eq(itemPropertyValues.propertyId, data.fill.id), eq(itemPropertyValues.valueText, 'down')))).resolves.toHaveLength(0)
  })

  it('rejects old original-category versions even when moderation selects a different fresh category', async () => {
    const data = await fixture()
    const { database } = resources()

    const destination = required(await database.insert(equipmentCategories).values({
      name: 'Fresh',
      slug: 'fresh'
    }).returning())

    await database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'update_option',
      propertyId: data.fill.id,
      optionId: data.down.id,

      settings: {
        name: 'Duck',
        slug: 'duck'
      }
    }))

    const body = {
      brandId: data.brand.id,
      categoryId: destination.id,
      name: 'Moderated',
      properties: [],
      expectedUpdatedAt: data.pending.updatedAt.toISOString(),
      expectedPropertiesRevision: 0,
      expectedOriginalPropertiesRevision: 0,
      decision: 'reject',
      rejectionReason: 'No'
    }

    await expect(updateSubmission(submissionEvent(data, body, data.pending.id))).rejects.toMatchObject({
      statusCode: 409,
      data: { code: 'properties_revision_conflict' }
    })

    await expect(database.select().from(equipmentItems).where(eq(equipmentItems.id, data.pending.id))).resolves.toMatchObject([{
      categoryId: data.category.id,
      status: 'pending'
    }])
  })

  it('does not lose a new characteristic when creation races with a full order update', async () => {
    const data = await fixture()
    const { database } = resources()
    const acquired = gate()
    const finish = gate()

    const creation = database.transaction(async (transaction) => {
      await mutateCategoryProperties(transaction, data.context, {
        action: 'create',

        settings: {
          expectedPropertiesRevision: 0,
          name: 'New',
          slug: 'new',
          dataType: 'text',
          allowsNegativeValues: false
        }
      })

      acquired.release()

      await finish.promise
    })

    await acquired.promise

    const reorder = database.transaction(async (transaction) => mutateCategoryProperties(transaction, data.context, {
      action: 'order',
      propertyIds: data.properties.map((property) => property.id).toReversed()
    }))

    // oxlint-disable-next-line vitest/valid-expect -- Attach rejection handling before releasing the blocking transaction; awaited below.
    const outcome = expect(reorder).rejects.toMatchObject({ statusCode: 409 })

    try { await waitForBlockedQueries('"equipment_categories"') } finally { finish.release() }

    await creation
    await outcome

    await expect(database.select().from(categoryProperties).where(eq(categoryProperties.categoryId, data.category.id))).resolves.toHaveLength(5)
  })
})

describe('properties revision migration', () => {
  it('adds version zero without changing legacy definitions, options, values, or IDs', async () => {
    const legacy = await createIsolatedPostgreSQL('properties_migration', { beforeMigration: '20261003151229_category-properties-revision' })

    try {
      const { database } = legacy
      const legacyCategories = await database.execute<{ id: number; }>(sql`insert into equipment_categories (name, slug) values ('Legacy', 'legacy') returning id`)
      const category = required(legacyCategories.rows)

      const brand = required(await database.insert(brands).values({
        name: 'Legacy',
        slug: 'legacy'
      }).returning())

      const property = required(await database.insert(categoryProperties).values({
        categoryId: category.id,
        name: 'Fill',
        slug: 'fill',
        dataType: 'enum',
        displayOrder: 4
      }).returning())

      const option = required(await database.insert(propertyEnumOptions).values({
        propertyId: property.id,
        name: 'Down',
        slug: 'down'
      }).returning())

      const item = required(await database.insert(equipmentItems).values({
        categoryId: category.id,
        brandId: brand.id,
        name: 'Legacy'
      }).returning())

      const value = required(await database.insert(itemPropertyValues).values({
        propertyId: property.id,
        itemId: item.id,
        valueText: 'down'
      }).returning())

      const migrationUrl = new URL('../../server/database/migrations/20261003151229_category-properties-revision/migration.sql', import.meta.url)
      const migration = await readFile(migrationUrl, 'utf8')

      await database.execute(sql.raw(migration))

      await expect(database.select().from(equipmentCategories)).resolves.toMatchObject([{
        id: category.id,
        propertiesRevision: 0
      }])

      await expect(database.select().from(categoryProperties)).resolves.toStrictEqual([property])
      await expect(database.select().from(propertyEnumOptions)).resolves.toStrictEqual([option])
      await expect(database.select().from(itemPropertyValues)).resolves.toStrictEqual([value])
    } finally { await legacy.dispose() }
  })
})
