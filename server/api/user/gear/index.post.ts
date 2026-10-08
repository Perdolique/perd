import type { InferInput } from 'valibot'
import { createError, defineEventHandler, readValidatedBody, setResponseStatus, type H3Event } from 'h3'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentCreateBody, type userEquipmentCreateBodySchema } from '#server/utils/validation/schemas'
import type { MyGearRecord } from './index.get'
import { throwMyGearError } from '#server/utils/my-gear-errors'

interface MyGearItemBrand {
  name: string;
  slug: string;
}

interface MyGearItemCategory {
  name: string;
  slug: string;
}

interface MyGearQueryItem {
  brand: MyGearItemBrand | null;
  category: MyGearItemCategory | null;
  id: string;
  name: string;
}

interface MyGearQueryRow {
  createdAt: Date | string;
  id: string;
  item: MyGearQueryItem | null;
}

export default defineEventHandler(async (event: H3Event<{ body: InferInput<typeof userEquipmentCreateBodySchema>; }>) : Promise<MyGearRecord> => {
  const userId = await validateSessionUser(event)
  const body = await readValidatedBody(event, validateUserEquipmentCreateBody)

  try {
    if ('customName' in body) {
      const [created] = await event.context.dbHttp
        .insert(userEquipment)
        .values({
          customName: body.customName,
          userId
        })
        .returning({
          id: userEquipment.id,
          customName: userEquipment.customName,
          createdAt: userEquipment.createdAt
        })

      if (created?.customName === undefined || created.customName === null) {
        throw createError({
          status: 500,
          message: 'Failed to create my gear row'
        })
      }

      setResponseStatus(event, 201)

      return {
        createdAt: created.createdAt,
        customName: created.customName,
        id: created.id,
        source: 'custom'
      }
    }

    const { itemId } = body

    const approvedItem = await event.context.dbHttp.query.equipmentItems.findFirst({
      columns: {
        id: true
      },

      where: {
        id: itemId,
        status: 'approved'
      }
    })

    if (approvedItem === undefined) {
      throw createError({ status: 404 })
    }

    const existingMyGearRow = await event.context.dbHttp.query.userEquipment.findFirst({
      columns: {
        id: true
      },

      where: {
        itemId,
        userId
      }
    })

    if (existingMyGearRow !== undefined) {
      throw createError({
        status: 409,
        message: 'Item is already in my gear'
      })
    }

    const [createdMyGearRow] = await event.context.dbHttp
      .insert(userEquipment)
      .values({
        itemId,
        userId
      })
      .returning({
        id: userEquipment.id
      })

    if (createdMyGearRow === undefined) {
      throw createError({
        status: 500,
        message: 'Failed to create my gear row'
      })
    }

    const myGearRow: MyGearQueryRow | undefined = await event.context.dbHttp.query.userEquipment.findFirst({
      columns: {
        createdAt: true,
        id: true
      },

      where: {
        id: createdMyGearRow.id,
        userId
      },

      with: {
        item: {
          columns: {
            id: true,
            name: true
          },

          with: {
            brand: {
              columns: {
                name: true,
                slug: true
              }
            },

            category: {
              columns: {
                name: true,
                slug: true
              }
            }
          }
        }
      }
    })

    const myGearItem = myGearRow?.item
    const myGearBrand = myGearItem?.brand
    const myGearCategory = myGearItem?.category

    if (
      myGearRow === undefined ||
      myGearItem === undefined ||
      myGearItem === null ||
      myGearBrand === undefined ||
      myGearBrand === null ||
      myGearCategory === undefined ||
      myGearCategory === null
    ) {
      throw createError({
        status: 500,
        message: 'Failed to load created my gear row'
      })
    }

    setResponseStatus(event, 201)

    return {
      source: 'catalog',
      createdAt: myGearRow.createdAt,
      id: myGearRow.id,

      item: {
        id: myGearItem.id,
        name: myGearItem.name,

        brand: {
          name: myGearBrand.name,
          slug: myGearBrand.slug
        },

        category: {
          name: myGearCategory.name,
          slug: myGearCategory.slug
        }
      }
    }
  } catch (error) {
    throwMyGearError(error, 'create')
  }
})
