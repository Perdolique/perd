import { createError, defineEventHandler, isError, readValidatedBody, setResponseStatus } from 'h3'
import { userEquipment } from '#server/database/schema'
import { validateSessionUser } from '#server/utils/session'
import { validateUserEquipmentCreateBody } from '#server/utils/validation/schemas'

interface MyGearItemBrand {
  name: string;
  slug: string;
}

interface MyGearItemCategory {
  name: string;
  slug: string;
}

interface CreatedMyGearItem {
  brand: MyGearItemBrand;
  category: MyGearItemCategory;
  id: string;
  name: string;
}

interface CreatedMyGearRecord {
  createdAt: Date | string;
  id: string;
  item: CreatedMyGearItem;
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

interface PostgresErrorWithCode {
  code: unknown;
}

function hasPostgresErrorCode(error: unknown): error is PostgresErrorWithCode {
  return error !== null && typeof error === 'object' && 'code' in error
}

function isUniqueViolation(error: unknown): boolean {
  return hasPostgresErrorCode(error) && error.code === '23505'
}

export default defineEventHandler(async (event) : Promise<CreatedMyGearRecord> => {
  const userId = await validateSessionUser(event)
  const { itemId } = await readValidatedBody(event, validateUserEquipmentCreateBody)

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

  try {
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
    if (isError(error)) {
      throw error
    }

    if (isUniqueViolation(error)) {
      throw createError({
        status: 409,
        message: 'Item is already in my gear'
      })
    }

    throw createError({
      status: 500,
      message: 'Failed to create my gear row'
    })
  }
})
